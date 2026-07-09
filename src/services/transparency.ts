import { normalizeDecimals } from '../helpers/common';
import { ProcessorContext } from '../common/dataSet';
import { Config } from '../common/types';
import {
  NaraApyChartPoint,
  NaraSupplyChartPoint,
  NaraTvlChartPoint,
  Network,
  PortVault,
} from '../model';
import { naraService, START_APY_CALC_DATE } from './nara';
import { portService } from './port';
import { Between, MoreThanOrEqual } from 'typeorm';

const LATEST_APY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const SUPPLY_BACKFILL_INTERVAL_MS = 24 * 60 * 60 * 1000;

// APR statistics are daily snapshots of the NaraUSD+ vesting distribution.
// `apr` is the point-in-time vesting run-rate APR, while `apy7d/14d/30d` are
// rolling averages of those daily APR snapshots.
const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_SUPPLY_BACKFILL_AT = new Map<string, number>();
const LAST_LATEST_SUPPLY_REFRESH_AT = new Map<string, number>();
const LAST_APY_BACKFILL_AT = new Map<string, number>();
const NEXT_DAILY_SNAPSHOT_TIMESTAMP_BY_NETWORK = new Map<string, DailySnapshotCursor>();

type BlockAtTimestamp = {
  height: number;
  timestamp: number;
};

type DailySnapshotCursor = {
  nextTimestamp: number;
  verifiedThrough: number;
};

function getDayEndTimestamp(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

function getDailyPointId(network: Network, timestampMs: number): string {
  return `${network}-${timestampMs}`;
}

function normalizeNetworkSlug(network: Network): string {
  switch (network) {
    case Network.ETHEREUM:
      return 'ethereum';
    case Network.ETHEREUM_SEPOLIA:
      return 'ethereum-sepolia';
    default:
      return String(network).toLowerCase().replace(/_/g, '-');
  }
}

function shouldCaptureDailySnapshot(currentTimestamp: number, nextTimestamp?: number): boolean {
  if (nextTimestamp == null) {
    return false;
  }

  return getDayEndTimestamp(currentTimestamp) !== getDayEndTimestamp(nextTimestamp);
}

function shouldBackfillNaraSupplyChartPoints(
  ctx: ProcessorContext,
  blockTimestamp: number
): boolean {
  if (!ctx.isHead || ctx.blocks.length !== 1) {
    return false;
  }

  const lastBackfillAt = LAST_SUPPLY_BACKFILL_AT.get(ctx.syncedNetwork) ?? 0;
  if (lastBackfillAt === 0) {
    return true;
  }

  return (blockTimestamp - lastBackfillAt) >= SUPPLY_BACKFILL_INTERVAL_MS;
}

async function getBlockAtOrBeforeTimestamp(
  ctx: ProcessorContext,
  startBlock: number,
  targetTimestamp: number
): Promise<BlockAtTimestamp> {
  let low = startBlock;
  let high = ctx.blocks[ctx.blocks.length - 1].header.height;
  let bestMatch: BlockAtTimestamp = {
    height: startBlock,
    timestamp: ctx.blocks[0].header.timestamp,
  };

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await ctx._chain.client.call('eth_getBlockByNumber', [
      `0x${mid.toString(16)}`,
      false,
    ]) as { timestamp: string } | null;

    if (!block?.timestamp) {
      throw new Error(`[NARA] Failed to fetch block ${mid} while resolving snapshot timestamp`);
    }

    const blockTimestamp = parseInt(block.timestamp, 16) * 1000;
    if (blockTimestamp <= targetTimestamp) {
      bestMatch = {
        height: mid,
        timestamp: blockTimestamp,
      };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestMatch;
}

async function getBlockTimestamp(ctx: ProcessorContext, blockHeight: number): Promise<number> {
  const block = await ctx._chain.client.call('eth_getBlockByNumber', [
    `0x${blockHeight.toString(16)}`,
    false,
  ]) as { timestamp: string } | null;

  if (!block?.timestamp) {
    throw new Error(`[NARA] Failed to fetch block ${blockHeight} timestamp`);
  }

  return parseInt(block.timestamp, 16) * 1000;
}

function hasVestingDistributionSnapshot(point: NaraApyChartPoint): boolean {
  return (
    point.naraUsdSupply > 0n &&
    point.naraUsdPlusTotalAssets > 0n &&
    point.naraUsdPlusLastDistributionAt > 0n &&
    point.naraUsdPlusVestingPeriod > 0n
  );
}

function calculateAverageAprForWindow(
  points: NaraApyChartPoint[],
  currentTimestamp: number,
  windowDays: number
): bigint | null {
  const windowStart = Math.max(
    currentTimestamp - ((windowDays - 1) * DAY_MS),
    START_APY_CALC_DATE
  );
  const aprValues = points
    .filter((point) => {
      const timestamp = Number(point.timestamp);
      return timestamp >= windowStart && timestamp <= currentTimestamp;
    })
    .filter(hasVestingDistributionSnapshot)
    .map((point) => point.apr);

  if (aprValues.length === 0) {
    return null;
  }

  const sum = aprValues.reduce((total, apr) => total + apr, 0n);
  return sum / BigInt(aprValues.length);
}

async function calculateRollingVestingAprAverages(params: {
  ctx: ProcessorContext;
  currentPoint: NaraApyChartPoint;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<{
  apy7d: bigint | null;
  apy14d: bigint | null;
  apy30d: bigint | null;
}> {
  const { ctx, currentPoint, naraApyChartPoints } = params;
  const currentTimestamp = Number(currentPoint.timestamp);
  const earliestWindowStart = Math.max(
    currentTimestamp - ((30 - 1) * DAY_MS),
    START_APY_CALC_DATE
  );

  const dbPoints = await ctx.store.find(NaraApyChartPoint, {
    where: {
      network: ctx.syncedNetwork,
      timestamp: Between(BigInt(earliestWindowStart), BigInt(currentTimestamp)),
    },
    order: { timestamp: 'ASC' },
  });

  const pointsById = new Map<string, NaraApyChartPoint>();
  for (const point of dbPoints) {
    pointsById.set(point.id, point);
  }
  for (const point of naraApyChartPoints.values()) {
    const timestamp = Number(point.timestamp);
    if (
      point.network === ctx.syncedNetwork &&
      timestamp >= earliestWindowStart &&
      timestamp <= currentTimestamp
    ) {
      pointsById.set(point.id, point);
    }
  }
  pointsById.set(currentPoint.id, currentPoint);

  const points = Array.from(pointsById.values());

  return {
    apy7d: calculateAverageAprForWindow(points, currentTimestamp, 7),
    apy14d: calculateAverageAprForWindow(points, currentTimestamp, 14),
    apy30d: calculateAverageAprForWindow(points, currentTimestamp, 30),
  };
}

export function findFirstMissingDailySnapshotTimestamp(params: {
  startTimestamp: number;
  lastCompleteDayEnd: number;
  existingTimestamps: Iterable<number>;
}): number {
  const { startTimestamp, lastCompleteDayEnd, existingTimestamps } = params;
  if (startTimestamp > lastCompleteDayEnd) {
    return lastCompleteDayEnd + DAY_MS;
  }

  const existingTimestampSet = new Set(existingTimestamps);
  for (
    let timestamp = startTimestamp;
    timestamp <= lastCompleteDayEnd;
    timestamp += DAY_MS
  ) {
    if (!existingTimestampSet.has(timestamp)) {
      return timestamp;
    }
  }

  return lastCompleteDayEnd + DAY_MS;
}

async function getNextMissingDailySnapshotTimestamp(params: {
  ctx: ProcessorContext;
  config: Config;
  lastCompleteDayEnd: number;
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
}): Promise<number> {
  const { ctx, config, lastCompleteDayEnd, naraSupplyChartPoints } = params;
  const startBlockTimestamp = await getBlockTimestamp(ctx, config.startBlock);
  const startTimestamp = getDayEndTimestamp(startBlockTimestamp);
  const existingTimestamps = new Set<number>();

  for (const point of naraSupplyChartPoints.values()) {
    const timestamp = Number(point.timestamp);
    if (
      point.network === ctx.syncedNetwork &&
      timestamp >= startTimestamp &&
      timestamp <= lastCompleteDayEnd
    ) {
      existingTimestamps.add(timestamp);
    }
  }

  const dbPoints = await ctx.store.find(NaraSupplyChartPoint, {
    where: {
      network: ctx.syncedNetwork,
      timestamp: Between(BigInt(startTimestamp), BigInt(lastCompleteDayEnd)),
    },
    order: { timestamp: 'ASC' },
  });

  for (const point of dbPoints) {
    existingTimestamps.add(Number(point.timestamp));
  }

  return findFirstMissingDailySnapshotTimestamp({
    startTimestamp,
    lastCompleteDayEnd,
    existingTimestamps,
  });
}

async function recalculateRollingVestingAprAveragesFromTimestamp(params: {
  ctx: ProcessorContext;
  startTimestamp: number;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<Map<string, NaraApyChartPoint>> {
  const { ctx, startTimestamp, naraApyChartPoints } = params;
  const latestAffectedTimestamp = startTimestamp + ((30 - 1) * DAY_MS);
  const dbPoints = await ctx.store.find(NaraApyChartPoint, {
    where: {
      network: ctx.syncedNetwork,
      timestamp: Between(BigInt(startTimestamp), BigInt(latestAffectedTimestamp)),
    },
    order: { timestamp: 'ASC' },
  });

  const pointsById = new Map<string, NaraApyChartPoint>();
  for (const point of dbPoints) {
    pointsById.set(point.id, point);
  }
  for (const point of naraApyChartPoints.values()) {
    const timestamp = Number(point.timestamp);
    if (
      point.network === ctx.syncedNetwork &&
      timestamp >= startTimestamp &&
      timestamp <= latestAffectedTimestamp
    ) {
      pointsById.set(point.id, point);
    }
  }

  const points = Array.from(pointsById.values())
    .sort((left, right) => Number(left.timestamp) - Number(right.timestamp));

  for (const point of points) {
    const { apy7d, apy14d, apy30d } = await calculateRollingVestingAprAverages({
      ctx,
      currentPoint: point,
      naraApyChartPoints,
    });

    point.apy7d = apy7d ?? 0n;
    point.apy14d = apy14d ?? 0n;
    point.apy30d = apy30d ?? 0n;
    naraApyChartPoints.set(point.id, point);
  }

  return naraApyChartPoints;
}

async function backfillMissingDailySnapshots(params: {
  ctx: ProcessorContext;
  config: Config;
  blockTimestamp: number;
  portVaults: Map<string, PortVault>;
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
  naraTvlChartPoints: Map<string, NaraTvlChartPoint>;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<{
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
  naraTvlChartPoints: Map<string, NaraTvlChartPoint>;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}> {
  let {
    ctx,
    config,
    blockTimestamp,
    portVaults,
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  } = params;

  const lastCompleteDayEnd = getDayEndTimestamp(blockTimestamp) - DAY_MS;
  const cacheKey = ctx.syncedNetwork;
  const cachedCursor = NEXT_DAILY_SNAPSHOT_TIMESTAMP_BY_NETWORK.get(cacheKey);
  let nextSnapshotTimestamp: number;

  if (cachedCursor && cachedCursor.verifiedThrough >= lastCompleteDayEnd) {
    nextSnapshotTimestamp = cachedCursor.nextTimestamp;
  } else if (cachedCursor && cachedCursor.nextTimestamp <= lastCompleteDayEnd) {
    nextSnapshotTimestamp = cachedCursor.nextTimestamp;
  } else {
    nextSnapshotTimestamp = await getNextMissingDailySnapshotTimestamp({
      ctx,
      config,
      lastCompleteDayEnd,
      naraSupplyChartPoints,
    });
  }

  let earliestBackfilledApyTimestamp: number | null = null;

  while (nextSnapshotTimestamp <= lastCompleteDayEnd) {
    const snapshotBlock = await getBlockAtOrBeforeTimestamp(
      ctx,
      config.startBlock,
      nextSnapshotTimestamp
    );

    ; ({
      naraSupplyChartPoints,
      naraTvlChartPoints,
      naraApyChartPoints,
    } = await captureDailySnapshotsForBlock({
      ctx,
      config,
      blockHeight: snapshotBlock.height,
      blockTimestamp: snapshotBlock.timestamp,
      portVaults,
      naraSupplyChartPoints,
      naraTvlChartPoints,
      naraApyChartPoints,
    }));

    if (naraService.hasNaraYieldMetrics(ctx.syncedNetwork)) {
      const snapshotTimestamp = getDayEndTimestamp(snapshotBlock.timestamp);
      earliestBackfilledApyTimestamp = Math.min(
        earliestBackfilledApyTimestamp ?? snapshotTimestamp,
        snapshotTimestamp
      );
    }

    nextSnapshotTimestamp += DAY_MS;
  }

  if (earliestBackfilledApyTimestamp != null) {
    naraApyChartPoints = await recalculateRollingVestingAprAveragesFromTimestamp({
      ctx,
      startTimestamp: earliestBackfilledApyTimestamp,
      naraApyChartPoints,
    });
  }

  NEXT_DAILY_SNAPSHOT_TIMESTAMP_BY_NETWORK.set(cacheKey, {
    nextTimestamp: nextSnapshotTimestamp,
    verifiedThrough: lastCompleteDayEnd,
  });

  return {
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  };
}

async function buildNaraApyChartPoint(params: {
  ctx: ProcessorContext;
  blockHeight: number;
  blockTimestamp: number;
  naraUsdSupply?: bigint;
  naraUsdPlusTotalAssets?: bigint;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<NaraApyChartPoint> {
  const {
    ctx,
    blockHeight,
    blockTimestamp,
    naraUsdSupply: suppliedNaraUsdSupply,
    naraUsdPlusTotalAssets: suppliedNaraUsdPlusTotalAssets,
    naraApyChartPoints,
  } = params;

  const snapshotTimestamp = getDayEndTimestamp(blockTimestamp);

  if (snapshotTimestamp < START_APY_CALC_DATE) {
    return new NaraApyChartPoint({
      id: getDailyPointId(ctx.syncedNetwork, snapshotTimestamp),
      network: ctx.syncedNetwork,
      timestamp: BigInt(snapshotTimestamp),
      block: BigInt(blockHeight),
      updatedAt: BigInt(blockTimestamp),
      exchangeRate: 0n,
      naraUsdSupply: suppliedNaraUsdSupply ?? 0n,
      naraUsdPlusTotalAssets: suppliedNaraUsdPlusTotalAssets ?? 0n,
      naraUsdPlusVestingAmount: 0n,
      naraUsdPlusLastDistributionAt: 0n,
      naraUsdPlusVestingPeriod: 0n,
      apr: 0n,
      apy7d: 0n,
      apy14d: 0n,
      apy30d: 0n,
    });
  }

  const [naraUsdSupply, naraUsdPlusTotalAssets, vestingDistribution] = await Promise.all([
    suppliedNaraUsdSupply != null
      ? Promise.resolve(suppliedNaraUsdSupply)
      : naraService.getNaraUsdTotalSupplyAtBlock(ctx, blockHeight)
          .then((supply) => supply?.rawSupply ?? 0n),
    suppliedNaraUsdPlusTotalAssets != null
      ? Promise.resolve(suppliedNaraUsdPlusTotalAssets)
      : naraService.getNaraUsdPlusTotalAssetsAtBlock(ctx, blockHeight)
          .then((assets) => assets?.rawAssets ?? 0n),
    naraService.getNaraUsdPlusVestingDistributionAtBlock(ctx, blockHeight),
  ]);

  const apr = vestingDistribution
    ? naraService.calculateVestingDistributionApr({
        naraUsdSupply,
        naraUsdPlusTotalAssets,
        naraUsdPlusVestingAmount: vestingDistribution.vestingAmount,
        naraUsdPlusLastDistributionAt: vestingDistribution.lastDistributionAt,
        naraUsdPlusVestingPeriod: vestingDistribution.vestingPeriod,
        blockTimestamp,
      })
    : null;

  const point = new NaraApyChartPoint({
    id: getDailyPointId(ctx.syncedNetwork, snapshotTimestamp),
    network: ctx.syncedNetwork,
    timestamp: BigInt(snapshotTimestamp),
    block: BigInt(blockHeight),
    updatedAt: BigInt(blockTimestamp),
    exchangeRate: 0n,
    naraUsdSupply,
    naraUsdPlusTotalAssets,
    naraUsdPlusVestingAmount: vestingDistribution?.vestingAmount ?? 0n,
    naraUsdPlusLastDistributionAt: vestingDistribution?.lastDistributionAt ?? 0n,
    naraUsdPlusVestingPeriod: vestingDistribution?.vestingPeriod ?? 0n,
    apr: apr ?? 0n,
    apy7d: 0n,
    apy14d: 0n,
    apy30d: 0n,
  });

  const { apy7d, apy14d, apy30d } = await calculateRollingVestingAprAverages({
    ctx,
    currentPoint: point,
    naraApyChartPoints,
  });

  point.apy7d = apy7d ?? 0n;
  point.apy14d = apy14d ?? 0n;
  point.apy30d = apy30d ?? 0n;

  return point;
}

async function captureDailySnapshotsForBlock(params: {
  ctx: ProcessorContext;
  config: Config;
  blockHeight: number;
  blockTimestamp: number;
  portVaults: Map<string, PortVault>;
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
  naraTvlChartPoints: Map<string, NaraTvlChartPoint>;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<{
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
  naraTvlChartPoints: Map<string, NaraTvlChartPoint>;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}> {
  const {
    ctx,
    config,
    blockHeight,
    blockTimestamp,
    portVaults,
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  } = params;

  const snapshotTimestamp = getDayEndTimestamp(blockTimestamp);
  const supplySnapshotBlock = await getBlockAtOrBeforeTimestamp(
    ctx,
    config.startBlock,
    snapshotTimestamp
  );

  const [naraUsdSupply, naraUsdPlusAssets] = await Promise.all([
    naraService.getNaraUsdTotalSupplyAtBlock(
      ctx,
      supplySnapshotBlock.height
    ),
    naraService.getNaraUsdPlusTotalAssetsAtBlock(
      ctx,
      supplySnapshotBlock.height
    ),
  ]);

  if (naraUsdSupply) {
    const supplyPointId = getDailyPointId(ctx.syncedNetwork, snapshotTimestamp);
    naraSupplyChartPoints.set(
      supplyPointId,
      new NaraSupplyChartPoint({
        id: supplyPointId,
        network: ctx.syncedNetwork,
        timestamp: BigInt(snapshotTimestamp),
        block: BigInt(supplySnapshotBlock.height),
        naraUsdSupply: naraUsdSupply.rawSupply,
        naraUsdSupplyFormatted: naraUsdSupply.formattedSupply,
        naraUsdPlusTotalAssets: naraUsdPlusAssets?.rawAssets ?? null,
        naraUsdPlusTotalAssetsFormatted: naraUsdPlusAssets?.formattedAssets ?? null,
      })
    );
  }

  const block = BigInt(blockHeight);

  const activeVaultConfigs = (config.Port?.Vaults ?? []).filter(
    (vault) => vault.block <= blockHeight
  );
  const activeVaultAddresses = new Set(
    activeVaultConfigs.map((vault) => vault.address.toLowerCase())
  );
  const tvlByChain = new Map<string, bigint>();

  for (const portVault of portVaults.values()) {
    if (!activeVaultAddresses.has(portVault.address.toLowerCase())) {
      continue;
    }

    const currentTvlRaw = await portService.calculateVaultTvlAtBlock(ctx, portVault, blockHeight);
    const currentTvl18 = normalizeDecimals(currentTvlRaw, Number(portVault.baseToken.decimals), 18);
    const chain = normalizeNetworkSlug(portVault.network);

    tvlByChain.set(chain, (tvlByChain.get(chain) ?? 0n) + currentTvl18);
  }

  for (const [chain, tvlUsd] of tvlByChain.entries()) {
    const tvlPointId = `${ctx.syncedNetwork}-${chain}-${snapshotTimestamp}`;
    naraTvlChartPoints.set(
      tvlPointId,
      new NaraTvlChartPoint({
        id: tvlPointId,
        network: ctx.syncedNetwork,
        chain,
        timestamp: BigInt(snapshotTimestamp),
        block,
        tvlUsd,
      })
    );
  }

  if (naraService.hasNaraYieldMetrics(ctx.syncedNetwork)) {
    const apyPoint = await buildNaraApyChartPoint({
      ctx,
      blockHeight,
      blockTimestamp,
      naraUsdSupply: naraUsdSupply?.rawSupply,
      naraUsdPlusTotalAssets: naraUsdPlusAssets?.rawAssets ?? undefined,
      naraApyChartPoints,
    });
    naraApyChartPoints.set(apyPoint.id, apyPoint);
  }

  return {
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  };
}

async function refreshLatestNaraSnapshotsIfDue(params: {
  ctx: ProcessorContext;
  config: Config;
  blockHeight: number;
  blockTimestamp: number;
  portVaults: Map<string, PortVault>;
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
  naraTvlChartPoints: Map<string, NaraTvlChartPoint>;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<{
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
  naraTvlChartPoints: Map<string, NaraTvlChartPoint>;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}> {
  const {
    ctx,
    config,
    blockHeight,
    blockTimestamp,
    portVaults,
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  } = params;

  const snapshotTimestamp = getDayEndTimestamp(blockTimestamp);
  if (!naraService.hasNaraYieldMetrics(ctx.syncedNetwork)) {
    const lastSupplyRefreshAt = LAST_LATEST_SUPPLY_REFRESH_AT.get(ctx.syncedNetwork) ?? 0;
    if (lastSupplyRefreshAt > 0 && blockTimestamp - lastSupplyRefreshAt < LATEST_APY_REFRESH_INTERVAL_MS) {
      return {
        naraSupplyChartPoints,
        naraTvlChartPoints,
        naraApyChartPoints,
      };
    }

    LAST_LATEST_SUPPLY_REFRESH_AT.set(ctx.syncedNetwork, blockTimestamp);
    return captureDailySnapshotsForBlock({
      ctx,
      config,
      blockHeight,
      blockTimestamp,
      portVaults,
      naraSupplyChartPoints,
      naraTvlChartPoints,
      naraApyChartPoints,
    });
  }

  const pointId = getDailyPointId(ctx.syncedNetwork, snapshotTimestamp);
  const existingPoint = naraApyChartPoints.get(pointId) ?? await ctx.store.findOne(NaraApyChartPoint, {
    where: { id: pointId },
  });

  if (
    existingPoint &&
    (blockTimestamp - Number(existingPoint.updatedAt)) < LATEST_APY_REFRESH_INTERVAL_MS
  ) {
    return {
      naraSupplyChartPoints,
      naraTvlChartPoints,
      naraApyChartPoints,
    };
  }

  return captureDailySnapshotsForBlock({
    ctx,
    config,
    blockHeight,
    blockTimestamp,
    portVaults,
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  });
}

async function backfillNaraSupplyChartPoints(params: {
  ctx: ProcessorContext;
  config: Config;
  naraSupplyChartPoints: Map<string, NaraSupplyChartPoint>;
}): Promise<Map<string, NaraSupplyChartPoint>> {
  const {
    ctx,
    config,
    naraSupplyChartPoints,
  } = params;

  const blockTimestamp = ctx.blocks[ctx.blocks.length - 1].header.timestamp;
  if (!shouldBackfillNaraSupplyChartPoints(ctx, blockTimestamp)) {
    return naraSupplyChartPoints;
  }

  const existingPoints = await ctx.store.find(NaraSupplyChartPoint, {
    where: { network: ctx.syncedNetwork },
    order: { timestamp: 'ASC' },
  });

  for (const existingPoint of existingPoints) {
    const supplySnapshotBlock = await getBlockAtOrBeforeTimestamp(
      ctx,
      config.startBlock,
      Number(existingPoint.timestamp)
    );
    const naraUsdSupply = await naraService.getNaraUsdTotalSupplyAtBlock(
      ctx,
      supplySnapshotBlock.height
    );

    if (!naraUsdSupply) {
      continue;
    }

    const naraUsdPlusAssets = await naraService.getNaraUsdPlusTotalAssetsAtBlock(
      ctx,
      supplySnapshotBlock.height
    );

    existingPoint.block = BigInt(supplySnapshotBlock.height);
    existingPoint.naraUsdSupply = naraUsdSupply.rawSupply;
    existingPoint.naraUsdSupplyFormatted = naraUsdSupply.formattedSupply;
    existingPoint.naraUsdPlusTotalAssets = naraUsdPlusAssets?.rawAssets ?? null;
    existingPoint.naraUsdPlusTotalAssetsFormatted = naraUsdPlusAssets?.formattedAssets ?? null;
    naraSupplyChartPoints.set(existingPoint.id, existingPoint);
  }

  LAST_SUPPLY_BACKFILL_AT.set(ctx.syncedNetwork, blockTimestamp);
  return naraSupplyChartPoints;
}

function shouldBackfillNaraApyChartPoints(ctx: ProcessorContext): boolean {
  if (!ctx.isHead || ctx.blocks.length !== 1) {
    return false;
  }
  if (!naraService.hasNaraYieldMetrics(ctx.syncedNetwork)) {
    return false;
  }
  // Run once per process: this propagates a methodology/anchor change to the
  // already-stored APR history in place, without a full resync.
  return (LAST_APY_BACKFILL_AT.get(ctx.syncedNetwork) ?? 0) === 0;
}

// Recompute vesting distribution snapshots and rolling APR averages only for
// legacy points created before vesting snapshot columns existed and after the
// APR anchor. Fresh syncs already build these fields correctly, and pre-anchor
// rows stay zero, so rebuilding every row would add a large RPC cost at head.
async function backfillNaraApyChartPoints(params: {
  ctx: ProcessorContext;
  config: Config;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<Map<string, NaraApyChartPoint>> {
  const { ctx, naraApyChartPoints } = params;

  if (!shouldBackfillNaraApyChartPoints(ctx)) {
    return naraApyChartPoints;
  }

  const existingPoints = await ctx.store.find(NaraApyChartPoint, {
    where: {
      network: ctx.syncedNetwork,
      naraUsdSupply: 0n,
      timestamp: MoreThanOrEqual(BigInt(START_APY_CALC_DATE)),
    },
    order: { timestamp: 'ASC' },
  });

  for (const point of existingPoints) {
    const pointBlockTimestamp = Number(point.updatedAt);
    const rebuiltPoint = await buildNaraApyChartPoint({
      ctx,
      blockHeight: Number(point.block),
      blockTimestamp: pointBlockTimestamp,
      naraApyChartPoints,
    });

    naraApyChartPoints.set(point.id, rebuiltPoint);
  }

  LAST_APY_BACKFILL_AT.set(ctx.syncedNetwork, ctx.blocks[ctx.blocks.length - 1].header.timestamp);
  return naraApyChartPoints;
}

export const transparencyService = {
  backfillMissingDailySnapshots,
  backfillNaraSupplyChartPoints,
  backfillNaraApyChartPoints,
  captureDailySnapshotsForBlock,
  refreshLatestNaraSnapshotsIfDue,
  shouldCaptureDailySnapshot,
};
