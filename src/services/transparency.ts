import { normalizeDecimals } from '../helpers/common';
import { ProcessorContext } from '../common/processor';
import { Config } from '../common/types';
import {
  NaraApyChartPoint,
  NaraSupplyChartPoint,
  NaraTvlChartPoint,
  Network,
  PortNavUpdate,
  PortVault,
  PortVaultType,
} from '../model';
import { naraService } from './nara';
import { portService } from './port';

function getDayEndTimestamp(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

function normalizeNetworkSlug(network: Network): string {
  switch (network) {
    case Network.ARBITRUM:
      return 'arbitrum';
    case Network.ARBITRUM_SEPOLIA:
      return 'arbitrum-sepolia';
    default:
      return String(network).toLowerCase().replace(/_/g, '-');
  }
}

function shouldCaptureDailySnapshot(currentTimestamp: number, nextTimestamp?: number): boolean {
  if (nextTimestamp == null) {
    return true;
  }

  return getDayEndTimestamp(currentTimestamp) !== getDayEndTimestamp(nextTimestamp);
}

async function captureDailySnapshotsForBlock(params: {
  ctx: ProcessorContext;
  config: Config;
  blockHeight: number;
  blockTimestamp: number;
  portVaults: Map<string, PortVault>;
  portNavUpdates: Map<string, PortNavUpdate>;
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
    portNavUpdates,
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  } = params;

  const snapshotTimestamp = getDayEndTimestamp(blockTimestamp);
  const block = BigInt(blockHeight);

  const naraMetrics = await naraService.getMetricsAtBlock(ctx, config, blockHeight, blockTimestamp);
  if (naraMetrics) {
    const supplyPointId = `${ctx.syncedNetwork}-${snapshotTimestamp}`;
    naraSupplyChartPoints.set(
      supplyPointId,
      new NaraSupplyChartPoint({
        id: supplyPointId,
        network: ctx.syncedNetwork,
        timestamp: BigInt(snapshotTimestamp),
        block,
        naraUsdSupply: naraMetrics.naraUsdSupply,
        naraUsdSupplyFormatted: naraMetrics.naraUsdSupplyFormatted,
      })
    );
  }

  const activeVaultConfigs = (config.Port?.Vaults ?? []).filter(
    (vault) => vault.block <= blockHeight
  );
  const activeVaultAddresses = new Set(
    activeVaultConfigs.map((vault) => vault.address.toLowerCase())
  );
  const tvlByChain = new Map<string, bigint>();

  let weightedApy7d = 0n;
  let weightedApy14d = 0n;
  let weightedApy30d = 0n;
  let weight7d = 0n;
  let weight14d = 0n;
  let weight30d = 0n;

  for (const portVault of portVaults.values()) {
    if (!activeVaultAddresses.has(portVault.address.toLowerCase())) {
      continue;
    }

    const currentTvlRaw = await portService.calculateVaultTvlAtBlock(ctx, portVault, blockHeight);
    const currentTvl18 = normalizeDecimals(currentTvlRaw, Number(portVault.baseToken.decimals), 18);
    const chain = normalizeNetworkSlug(portVault.network);

    tvlByChain.set(chain, (tvlByChain.get(chain) ?? 0n) + currentTvl18);

    if (portVault.type !== PortVaultType.STANDARD || currentTvl18 <= 0n) {
      continue;
    }

    const startApyCalculationTimestamp = activeVaultConfigs.find(
      (vault) => vault.address.toLowerCase() === portVault.address.toLowerCase()
    )?.StartApyCalculationTimestamp;

    const [apy7d, apy14d, apy30d] = await Promise.all([
      portService.calculateRollingAPR(
        ctx,
        portVault.address,
        portVault.currentNav,
        blockTimestamp,
        7,
        portVault.startedAt,
        startApyCalculationTimestamp,
        portNavUpdates
      ),
      portService.calculateRollingAPR(
        ctx,
        portVault.address,
        portVault.currentNav,
        blockTimestamp,
        14,
        portVault.startedAt,
        startApyCalculationTimestamp,
        portNavUpdates
      ),
      portService.calculateRollingAPR(
        ctx,
        portVault.address,
        portVault.currentNav,
        blockTimestamp,
        30,
        portVault.startedAt,
        startApyCalculationTimestamp,
        portNavUpdates
      ),
    ]);

    if (apy7d.apr !== null) {
      weightedApy7d += apy7d.apr * currentTvl18;
      weight7d += currentTvl18;
    }

    if (apy14d.apr !== null) {
      weightedApy14d += apy14d.apr * currentTvl18;
      weight14d += currentTvl18;
    }

    if (apy30d.apr !== null) {
      weightedApy30d += apy30d.apr * currentTvl18;
      weight30d += currentTvl18;
    }
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

  const apyPointId = `${ctx.syncedNetwork}-${snapshotTimestamp}`;
  naraApyChartPoints.set(
    apyPointId,
    new NaraApyChartPoint({
      id: apyPointId,
      network: ctx.syncedNetwork,
      timestamp: BigInt(snapshotTimestamp),
      block,
      apy7d: weight7d > 0n ? weightedApy7d / weight7d : 0n,
      apy14d: weight14d > 0n ? weightedApy14d / weight14d : 0n,
      apy30d: weight30d > 0n ? weightedApy30d / weight30d : 0n,
    })
  );

  return {
    naraSupplyChartPoints,
    naraTvlChartPoints,
    naraApyChartPoints,
  };
}

export const transparencyService = {
  captureDailySnapshotsForBlock,
  shouldCaptureDailySnapshot,
};
