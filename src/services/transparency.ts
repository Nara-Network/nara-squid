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
import { naraService } from './nara';
import { portService } from './port';

const LATEST_APY_REFRESH_INTERVAL_MS = 30 * 60 * 1000;
const SUPPLY_BACKFILL_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_SUPPLY_BACKFILL_AT = new Map<string, number>();
const LAST_LATEST_SUPPLY_REFRESH_AT = new Map<string, number>();

type BlockAtTimestamp = {
  height: number;
  timestamp: number;
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

async function buildNaraApyChartPoint(params: {
  ctx: ProcessorContext;
  blockHeight: number;
  blockTimestamp: number;
  naraApyChartPoints: Map<string, NaraApyChartPoint>;
}): Promise<NaraApyChartPoint> {
  const {
    ctx,
    blockHeight,
    blockTimestamp,
    naraApyChartPoints,
  } = params;

  const snapshotTimestamp = getDayEndTimestamp(blockTimestamp);
  const currentExchangeRate = await naraService.getNaraUsdPlusExchangeRateAtBlock(ctx, blockHeight);
  const [apr, apy7d, apy14d, apy30d] = currentExchangeRate == null
    ? [
        null as bigint | null,
        { apr: null as bigint | null },
        { apr: null as bigint | null },
        { apr: null as bigint | null },
      ]
    : await Promise.all([
        naraService.calculateActualAPR(ctx, currentExchangeRate, blockTimestamp, naraApyChartPoints),
        naraService.calculateRollingAPR(ctx, currentExchangeRate, blockTimestamp, 7, naraApyChartPoints),
        naraService.calculateRollingAPR(ctx, currentExchangeRate, blockTimestamp, 14, naraApyChartPoints),
        naraService.calculateRollingAPR(ctx, currentExchangeRate, blockTimestamp, 30, naraApyChartPoints),
      ]);

  return new NaraApyChartPoint({
    id: getDailyPointId(ctx.syncedNetwork, snapshotTimestamp),
    network: ctx.syncedNetwork,
    timestamp: BigInt(snapshotTimestamp),
    block: BigInt(blockHeight),
    updatedAt: BigInt(blockTimestamp),
    exchangeRate: currentExchangeRate ?? 0n,
    apr: apr ?? 0n,
    apy7d: apy7d.apr ?? 0n,
    apy14d: apy14d.apr ?? 0n,
    apy30d: apy30d.apr ?? 0n,
  });
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

  const naraUsdSupply = await naraService.getNaraUsdTotalSupplyAtBlock(
    ctx,
    supplySnapshotBlock.height
  );
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

    existingPoint.block = BigInt(supplySnapshotBlock.height);
    existingPoint.naraUsdSupply = naraUsdSupply.rawSupply;
    existingPoint.naraUsdSupplyFormatted = naraUsdSupply.formattedSupply;
    naraSupplyChartPoints.set(existingPoint.id, existingPoint);
  }

  LAST_SUPPLY_BACKFILL_AT.set(ctx.syncedNetwork, blockTimestamp);
  return naraSupplyChartPoints;
}

export const transparencyService = {
  backfillNaraSupplyChartPoints,
  captureDailySnapshotsForBlock,
  refreshLatestNaraSnapshotsIfDue,
  shouldCaptureDailySnapshot,
};
