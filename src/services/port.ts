import { ProcessorContext } from '../common/processor';

import { Config } from '../common/types';
import { calculateUsdPriceInBN, convertToBaseTokenAmount, readContract } from '../helpers/common';

import { Network, PortVault, PortWithdrawalRequest, PortWithdrawalRequestStatus, PortVaultStatus, PortNavUpdate, PortGlobalStats, PortVaultAPY, PortVaultType, ExpectedExchangeRate, PortVaultApyChart } from '../model';
import * as BoringVaultAbi from '../abi/BoringVault';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import * as TellerAbi from '../abi/TellerWithMultiAssetSupport';
import { tokensService } from './tokens';
import { In, Not, MoreThanOrEqual, LessThan, LessThanOrEqual } from 'typeorm';
import { toEntityMap } from '../common/mapping/helpers';
import { throwError } from '../common/utils/error';
import { floorToHour, floorToMonthUTC, toSec } from '../common/utils/time';

let PORT_INITIALIZED_VAULTS = new Map<string, boolean>();
let LAST_AVG_APY_UPDATE: Date | undefined;
let AVG_APY_UPDATE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
let LAST_APY_CHART_UPDATE: Date | undefined;

async function getPortVaultByAddress(ctx: ProcessorContext, address: string): Promise<PortVault | null> {
  const portVault = await ctx.store.findOne(PortVault, { where: { address: address.toLowerCase(), network: ctx.syncedNetwork }, relations: { baseToken: true } })
  return portVault ?? null;
}

async function initializePort({ ctx, config, portVaults, expectedExchangeRates }: { ctx: ProcessorContext, config: Config, portVaults: Map<string, PortVault>, expectedExchangeRates: Map<string, ExpectedExchangeRate> }): Promise<{ portVaults: Map<string, PortVault>, expectedExchangeRates: Map<string, ExpectedExchangeRate> }> {
  if (ctx.syncedNetwork !== Network.ARBITRUM && ctx.syncedNetwork !== Network.ARBITRUM_SEPOLIA) {
    return { portVaults, expectedExchangeRates };
  }

  const configuredPortVaults = config.Port?.Vaults;
  if (!configuredPortVaults?.length) {
    return { portVaults, expectedExchangeRates };
  }

  for (const portVault of configuredPortVaults) {
    const vaultKey = `${ctx.syncedNetwork}-${portVault.address.toLowerCase()}`;
    if (PORT_INITIALIZED_VAULTS.get(vaultKey)) {
      continue;
    }

    const latestBlock = ctx.blocks[ctx.blocks.length - 1];
    const lastBlockHeight = latestBlock.header.height;

    if (portVault.block > lastBlockHeight) {
      continue;
    }

    const existingVault = await getPortVaultByAddress(ctx, portVault.address);

    if (existingVault) {
      // Mark as initialized even if it already exists in the database
      PORT_INITIALIZED_VAULTS.set(vaultKey, true);
      continue;
    }

    const [name, symbol, decimals, accountantState, base, isPaused, lendingInfo, depositCap] = await Promise.all([
      readContract(ctx, portVault.address, BoringVaultAbi, 'name', [], portVault.block),
      readContract(ctx, portVault.address, BoringVaultAbi, 'symbol', [], portVault.block),
      readContract(ctx, portVault.address, BoringVaultAbi, 'decimals', [], portVault.block),
      readContract(ctx, portVault.Accountant, AccountantAbi, 'accountantState', [], portVault.block),
      readContract(ctx, portVault.Accountant, AccountantAbi, 'base', [], portVault.block),
      readContract(ctx, portVault.Teller, TellerAbi, 'isPaused', [], portVault.block),
      readContract(ctx, portVault.Accountant, AccountantAbi, 'lendingInfo', [], portVault.block),
      readContract(ctx, portVault.Teller, TellerAbi, 'depositCap', [], portVault.block),
    ]);

    const baseToken = await tokensService.getTokenByAddress(ctx, base);

    if (!baseToken) {
      throwError(`Base token not found for port vault ${portVault.address}`, portVault.address);
    }

    const vault = new PortVault({
      id: createPortVaultId(portVault.address, ctx),
      address: portVault.address.toLowerCase(),
      network: ctx.syncedNetwork,
      startedAt: BigInt(latestBlock.header.timestamp),
      totalActivity: BigInt(0),
      name,
      symbol,
      decimals: Number(decimals),
      managementFee: BigInt(accountantState._managementFee),
      currentNav: BigInt(accountantState._exchangeRate),
      apy: lendingInfo ? BigInt(lendingInfo._lendingRate) : BigInt(0),
      tvl: BigInt(0),
      avg7dApy: BigInt(0),
      avg30dApy: BigInt(0),
      avg1yApy: BigInt(0),
      riskLevel: 0,
      totalWithdrawalRequestsInBaseToken: BigInt(0),
      totalPendingWithdrawalRequests: BigInt(0),
      status: isPaused ? PortVaultStatus.PAUSED : PortVaultStatus.ACTIVE,
      assets: [baseToken.address],
      baseToken: baseToken,
      teller: portVault.Teller.toLowerCase(),
      accountant: portVault.Accountant.toLowerCase(),
      atomicQueue: portVault.AtomicQueue.toLowerCase(),
      atomicSolver: portVault.AtomicSolver.toLowerCase(),
      rolesAuthority: portVault.RolesAuthority.toLowerCase(),
      manager: portVault.Manager.toLowerCase(),
      depositCap,
      type: PortVaultType.STANDARD,
      fundsDiverted: BigInt(0),
    });

    const eerEnabled = portVault.expectedExchangeRateConfig !== undefined;

    if (eerEnabled) {

      // Use base token decimals for initial exchange rate (1.0 in base decimals)
      const baseDec = Number(baseToken.decimals)
      const baseDecFactor = 10n ** BigInt(baseDec)
      const nowSec = toSec(latestBlock.header.timestamp)
      const monthStartTs = floorToMonthUTC(nowSec)

      // Expected Exchange Rate
      // NOTE: Both shares and netAssets are event-tracked; do not read totalSupply from contract.
      // totalSharesTracked starts at 0 and is updated ONLY via Enter (increase) and
      // AtomicRequestFulfilled/withdrawal (decrease) events.
      // netAssetsTrackedBaseRaw starts at 0 and is updated via:
      // - Enter events (+deposit amount)
      // - AtomicRequestFulfilled/withdrawal (-withdrawn amount)
      // - Time window accrual (+interest, -fees)
      const expectedExchangeRate = new ExpectedExchangeRate({
        id: vault.id,
        vault,
        expectedLastAccrualTs: nowSec,
        expectedLastUpdateTs: floorToHour(nowSec),
        expectedAssetsBaseRaw: BigInt(0),
        expectedBorrowedBaseRaw: BigInt(0),
        expectedBorrowedPrincipalBaseRaw: BigInt(0),
        expectedExchangeRateBaseRaw: baseDecFactor, // initial 1.0 in base token decimals (NOT WAD)
        commitmentFeeAccruedMtdBaseRaw: BigInt(0),
        commitmentFeeProjectedMonthEndBaseRaw: BigInt(0),
        commitmentFeeMtdMonthStartTs: monthStartTs,
        expectedRepaymentPendingBaseRaw: BigInt(0),
        expectedRepaymentCreditBaseRaw: BigInt(0),
        borrowRateBps: BigInt(portVault.expectedExchangeRateConfig?.borrowRateBps ?? 0),
        commitmentFeeRateBps: BigInt(0),
        totalSharesTracked: 0n,  // Start at 0, updated via Enter/RequestFulfilled events only
        totalSharesSource: 'event_tracked',
        netAssetsTrackedBaseRaw: 0n,  // Start at 0, updated via event deltas + time window accrual
        idleBaseTracked: BigInt(0),  // Simplified EER tracking
        investedBaseTracked: BigInt(0),  // Simplified EER tracking - funds deployed to strategies
        accruedCommitmentFeeBase: BigInt(0),  // Simplified EER tracking
        accruedBorrowInterestBase: BigInt(0),  // Simplified EER tracking
        borrowInterestAccruedMtdBaseRaw: BigInt(0),
        borrowInterestProjectedMonthEndBaseRaw: BigInt(0),
        borrowInterestMtdMonthStartTs: monthStartTs,
        lastAccrualBlock: BigInt(portVault.block),
        strategyYieldBase: BigInt(0),
        lastSnapshotTsUsed: 0,
        commitFeeRemainderNumerator: BigInt(0),
        borrowInterestRemainderNumerator: BigInt(0),
      } as ExpectedExchangeRate)

      ctx.log.info(
        `[EVENT TRACK INIT] vault=${vault.address} totalSharesTracked=0 netAssetsTrackedBaseRaw=0 ` +
        `source=event_tracked (bootstrapping - will track deltas from Enter/RequestFulfilled events)`
      )

      expectedExchangeRates.set(expectedExchangeRate.id, expectedExchangeRate);
    }
    portVaults.set(portVault.address.toLowerCase(), vault);

    PORT_INITIALIZED_VAULTS.set(vaultKey, true);
  }

  return {
    portVaults,
    expectedExchangeRates,
  };
}

async function getGlobalStats(ctx: ProcessorContext): Promise<PortGlobalStats> {
  const portGlobalStats = await ctx.store.find(PortGlobalStats, { where: { network: ctx.syncedNetwork } });
  if (!portGlobalStats.length) {
    return new PortGlobalStats({
      id: ctx.syncedNetwork,
      activeUsers: BigInt(0),
      network: ctx.syncedNetwork,
    });
  }
  return portGlobalStats[0];
}

async function calculateAPRFromRate(ctx: ProcessorContext, lastNavUpdate: PortNavUpdate, vault: PortVault, startApyCalculationTimestamp?: number): Promise<bigint> {
  const navDecimals = Math.pow(10, 18);

  let navStartRaw = 0;
  let navEndRaw = 0;
  let timeStart = 0;
  const timeEnd = Number(lastNavUpdate.timestamp);

  timeStart = startApyCalculationTimestamp ?? Number(vault.startedAt);

  navStartRaw = Number(BigInt(1 * navDecimals));
  navEndRaw = Number(lastNavUpdate.newRate);

  const navStart = navStartRaw / navDecimals;
  const navEnd = navEndRaw / navDecimals;

  if (navStart === 0 || navEnd === 0) {
    ctx.log.warn(`[APR] Vault ${vault.id}: Invalid NAV values - Start: ${navStart}, End: ${navEnd}`);
    return BigInt(0);
  }

  const daysElapsed = (timeEnd - timeStart) / (1000 * 60 * 60 * 24);

  const MIN_HOURS_FOR_APR = 1;
  const minDaysForAPR = MIN_HOURS_FOR_APR / 24;

  if (daysElapsed < minDaysForAPR) {
    ctx.log.info(`[APR DEBUG] Vault ${vault.id}: Not enough time elapsed (${daysElapsed} < ${minDaysForAPR})`);
    return BigInt(0); // Not enough time has passed
  }

  if (daysElapsed <= 0) {
    ctx.log.warn(`[APR] Vault ${vault.id}: Invalid time period (${daysElapsed} days)`);
    return BigInt(0);
  }

  const navReturn = navEnd / navStart;

  const apr = (navReturn - 1) * (365 / daysElapsed);

  const MAX_APR_BPS = 100000;
  let aprBps = Math.round(apr * 10000);

  if (aprBps > MAX_APR_BPS) {
    aprBps = MAX_APR_BPS;
    ctx.log.info(`[APR DEBUG] Vault ${vault.id}: APR capped to ${MAX_APR_BPS}`);
  }

  if (!Number.isFinite(aprBps) || Number.isNaN(aprBps)) {
    ctx.log.warn(`[APR DEBUG] Vault ${vault.id}: Invalid aprBps=${aprBps}, returning 0`);
    return BigInt(0);
  }

  return BigInt(aprBps);
}

async function calculateAverageAPYForPeriod(
  ctx: ProcessorContext,
  vaultAddress: string,
  days: number,
  currentTimestamp: number,
  portVaultAPYs: Map<string, PortVaultAPY>
): Promise<bigint> {
  const cutoffTimestamp = currentTimestamp - (days * 24 * 60 * 60 * 1000);

  // Get from DB
  const dbRecords = await ctx.store.find(PortVaultAPY, {
    where: {
      vault: { address: vaultAddress, network: ctx.syncedNetwork },
      timestamp: MoreThanOrEqual(BigInt(cutoffTimestamp))
    },
    order: { timestamp: 'DESC' }
  });

  // Get from in-memory map
  const memRecords = Array.from(portVaultAPYs.values()).filter(
    rec => rec.vault.address === vaultAddress && Number(rec.timestamp) >= cutoffTimestamp
  );

  // Combine and deduplicate by id
  const allRecordsMap: { [id: string]: PortVaultAPY } = {};
  for (const rec of [...dbRecords, ...memRecords]) {
    allRecordsMap[rec.id] = rec;
  }
  const apyRecords = Object.values(allRecordsMap);

  if (apyRecords.length === 0) {
    return BigInt(0);
  }

  const avg = apyRecords.reduce((sum, rec) => sum + Number(rec.apy), 0) / apyRecords.length;
  const result = BigInt(Math.round(avg));

  return result;
}

async function calculateRollingAPR(
  ctx: ProcessorContext,
  vaultAddress: string,
  currentExchangeRate: bigint,
  currentTimestamp: number,
  days: number,
  vaultStartedAt: bigint,
  startApyCalculationTimestamp?: number,
  portNavUpdates?: Map<string, PortNavUpdate>
): Promise<{ apr: bigint | null; historicalER: bigint }> {
  const daysAgoStart = currentTimestamp - (days * 24 * 60 * 60 * 1000);
  const daysAgoDate = new Date(daysAgoStart);
  daysAgoDate.setHours(23, 59, 59, 999);
  const cutoffTimestamp = daysAgoDate.getTime();

  const dbNavUpdates = await ctx.store.find(PortNavUpdate, {
    where: {
      vault: { address: vaultAddress, network: ctx.syncedNetwork },
      timestamp: LessThanOrEqual(BigInt(cutoffTimestamp))
    },
    order: { timestamp: 'DESC' },
    take: 1
  });

  const memNavUpdates = portNavUpdates
    ? Array.from(portNavUpdates.values())
      .filter(update => update.vault.address === vaultAddress && Number(update.timestamp) <= cutoffTimestamp)
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
      .slice(0, 1)
    : [];

  const navUpdates = [...memNavUpdates, ...dbNavUpdates]
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
    .slice(0, 1);

  const navDecimals = 10n ** 18n;
  let erPast: number;
  let historicalER: bigint;
  let annualizationFactor: number;

  if (navUpdates.length === 0) {
    erPast = 1.0;
    historicalER = navDecimals;
    // No data at the lookback cutoff — vault is younger than the requested window.
    // Annualize based on actual elapsed time from inception instead of the full window.
    const effectiveStart = startApyCalculationTimestamp ?? Number(vaultStartedAt);
    const actualDaysElapsed = (currentTimestamp - effectiveStart) / (24 * 60 * 60 * 1000);
    if (actualDaysElapsed < (1 / 24)) { // Less than 1 hour
      return { apr: null, historicalER };
    }
    annualizationFactor = 365 / actualDaysElapsed;
  } else {
    const historicalNavUpdate = navUpdates[0];
    const historicalExchangeRate = historicalNavUpdate.newRate;

    if (historicalExchangeRate === 0n) {
      ctx.log.warn(`[Rolling APR] Invalid historical exchange rate (0) for vault ${vaultAddress}, using 1.0`);
      erPast = 1.0;
      historicalER = navDecimals;
    } else {
      erPast = Number(historicalExchangeRate) / Number(navDecimals);
      if (erPast === 0) {
        ctx.log.warn(`[Rolling APR] Invalid past exchange rate (0) for vault ${vaultAddress}, using 1.0`);
        erPast = 1.0;
        historicalER = navDecimals;
      } else {
        historicalER = historicalExchangeRate;
      }
    }
    annualizationFactor = Math.round(365 / days);
  }

  if (currentExchangeRate === 0n) {
    ctx.log.warn(`[Rolling APR] Invalid current exchange rate (0) for vault ${vaultAddress}`);
    return { apr: null, historicalER };
  }

  const erCurrent = Number(currentExchangeRate) / Number(navDecimals);

  const navReturn = erCurrent / erPast;
  const apr = (navReturn - 1) * annualizationFactor;
  const aprBps = Math.round(apr * 10000);

  const MAX_APR_BPS = 100000;
  const clampedAprBps = Math.min(Math.max(aprBps, -MAX_APR_BPS), MAX_APR_BPS);

  if (!Number.isFinite(clampedAprBps) || Number.isNaN(clampedAprBps)) {
    ctx.log.warn(`[Rolling APR] Invalid aprBps=${aprBps} for vault ${vaultAddress}`);
    return { apr: null, historicalER };
  }

  return { apr: BigInt(clampedAprBps), historicalER };
}

async function calculateRollingAprSeries(
  ctx: ProcessorContext,
  vault: PortVault,
  currentExchangeRate: bigint,
  timestamp: number,
  startApyCalculationTimestamp?: number,
  portNavUpdates?: Map<string, PortNavUpdate>
) {
  const [result7d, result14d, result30d, result365d] = await Promise.all([
    calculateRollingAPR(ctx, vault.address, currentExchangeRate, timestamp, 7, vault.startedAt, startApyCalculationTimestamp, portNavUpdates),
    calculateRollingAPR(ctx, vault.address, currentExchangeRate, timestamp, 14, vault.startedAt, startApyCalculationTimestamp, portNavUpdates),
    calculateRollingAPR(ctx, vault.address, currentExchangeRate, timestamp, 30, vault.startedAt, startApyCalculationTimestamp, portNavUpdates),
    calculateRollingAPR(ctx, vault.address, currentExchangeRate, timestamp, 365, vault.startedAt, startApyCalculationTimestamp, portNavUpdates),
  ]);

  return {
    result7d,
    result14d,
    result30d,
    result365d,
    hasAnyApr:
      result7d.apr !== null ||
      result14d.apr !== null ||
      result30d.apr !== null ||
      result365d.apr !== null,
  };
}

async function getOrCreateDailyChartEntry(
  ctx: ProcessorContext,
  vault: PortVault,
  currentExchangeRate: bigint,
  currentTimestamp: number,
  currentBlock: bigint,
  portVaultApyCharts: Map<string, PortVaultApyChart>,
  startApyCalculationTimestamp?: number,
  portNavUpdates?: Map<string, PortNavUpdate>
): Promise<PortVaultApyChart | null> {
  const currentDate = new Date(currentTimestamp);
  currentDate.setHours(23, 59, 59, 999);
  const currentDayEnd = currentDate.getTime();
  const currentDayStart = currentDayEnd - (24 * 60 * 60 * 1000) + 1;

  // Backfill missing days between last entry and current day (during historical sync)
  const recentCharts = await ctx.store.find(PortVaultApyChart, {
    where: {
      vault: { address: vault.address, network: ctx.syncedNetwork },
    },
    order: { timestamp: 'DESC' },
    take: 1
  });

  const memRecentCharts = Array.from(portVaultApyCharts.values())
    .filter(chart => chart.vault?.address === vault.address)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

  const lastChart = memRecentCharts.length > 0 
    ? memRecentCharts[0] 
    : (recentCharts.length > 0 ? recentCharts[0] : null);

  if (lastChart) {
    const lastDate = new Date(Number(lastChart.timestamp));
    lastDate.setHours(23, 59, 59, 999);
    const lastDayEnd = lastDate.getTime();

    // Backfill missing days between last entry and current day
    if (lastDayEnd < currentDayEnd) {
      let dayToBackfill = lastDayEnd + (24 * 60 * 60 * 1000); // Start from day after last entry
      
      while (dayToBackfill < currentDayEnd) {
        const dayStart = dayToBackfill - (24 * 60 * 60 * 1000) + 1;
        
        // Check if we already have an entry for this day
        const existingForDay = await ctx.store.find(PortVaultApyChart, {
          where: {
            vault: { address: vault.address, network: ctx.syncedNetwork },
            timestamp: MoreThanOrEqual(BigInt(dayStart)),
          },
          order: { timestamp: 'ASC' },
          take: 1
        });

        const memForDay = Array.from(portVaultApyCharts.values()).filter(
          chart => chart.vault?.address === vault.address && 
                   Number(chart.timestamp) >= dayStart && 
                   Number(chart.timestamp) <= dayToBackfill
        );

        // If no entry exists for this day, create one
        if (existingForDay.length === 0 && memForDay.length === 0) {
          // Find the most recent NAV update before or on this day
          const navForDay = await ctx.store.find(PortNavUpdate, {
            where: {
              vault: { address: vault.address, network: ctx.syncedNetwork },
              timestamp: LessThanOrEqual(BigInt(dayToBackfill)),
            },
            order: { timestamp: 'DESC' },
            take: 1
          });

          if (navForDay.length > 0) {
            const navUpdate = navForDay[0];
            const exchangeRateForDay = navUpdate.newRate;
            // Use the NAV that was valid at the end of this day for calculation
            const { result7d, result14d, result30d, result365d, hasAnyApr } =
              await calculateRollingAprSeries(
                ctx,
                vault,
                exchangeRateForDay,
                dayToBackfill,
                startApyCalculationTimestamp,
                portNavUpdates
              );

            if (hasAnyApr) {
              const chartId = `${vault.id}-${dayToBackfill}`;
              const portVaultApyChart = new PortVaultApyChart({
                id: chartId,
                vault: vault,
                apy7d: result7d.apr ?? BigInt(0),
                apy14d: result14d.apr ?? BigInt(0),
                apy30d: result30d.apr ?? BigInt(0),
                apy365d: result365d.apr ?? BigInt(0),
                timestamp: BigInt(dayToBackfill), // Store at end of day (23:59:59)
                block: navUpdate.block,
                exchangeRate: exchangeRateForDay,
                exchangeRate7dAgo: result7d.historicalER,
                exchangeRate14dAgo: result14d.historicalER,
                exchangeRate30dAgo: result30d.historicalER,
                exchangeRate365dAgo: result365d.historicalER,
              });
              portVaultApyCharts.set(chartId, portVaultApyChart);
            }
          }
        }

        dayToBackfill += (24 * 60 * 60 * 1000); // Move to next day
      }
    }
  }

  // Check if we already have an entry for today (in memory or database)
  const memEntryToday = Array.from(portVaultApyCharts.values()).find(
    chart => chart.vault?.address === vault.address && 
             Number(chart.timestamp) >= currentDayStart && 
             Number(chart.timestamp) <= currentDayEnd
  );

  if (memEntryToday) {
    // Update existing entry with new values, but keep timestamp at end of day
    // Use currentDayEnd (23:59:59) for calculation, not currentTimestamp
    const { result7d, result14d, result30d, result365d, hasAnyApr } =
      await calculateRollingAprSeries(
        ctx,
        vault,
        currentExchangeRate,
        currentDayEnd,
        startApyCalculationTimestamp,
        portNavUpdates
      );

    if (hasAnyApr) {
      memEntryToday.apy7d = result7d.apr ?? BigInt(0);
      memEntryToday.apy14d = result14d.apr ?? BigInt(0);
      memEntryToday.apy30d = result30d.apr ?? BigInt(0);
      memEntryToday.apy365d = result365d.apr ?? BigInt(0);
      memEntryToday.exchangeRate = currentExchangeRate;
      memEntryToday.exchangeRate7dAgo = result7d.historicalER;
      memEntryToday.exchangeRate14dAgo = result14d.historicalER;
      memEntryToday.exchangeRate30dAgo = result30d.historicalER;
      memEntryToday.exchangeRate365dAgo = result365d.historicalER;
      memEntryToday.block = currentBlock;
      // Always store timestamp at end of day (23:59:59) for consistency
      memEntryToday.timestamp = BigInt(currentDayEnd);
      return memEntryToday;
    }
    return null;
  }

  // Check database
  const dbEntryToday = await ctx.store.find(PortVaultApyChart, {
    where: {
      vault: { address: vault.address, network: ctx.syncedNetwork },
      timestamp: MoreThanOrEqual(BigInt(currentDayStart)),
    },
    relations: { vault: true },
    order: { timestamp: 'ASC' },
    take: 1
  });

  if (dbEntryToday.length > 0 && Number(dbEntryToday[0].timestamp) <= currentDayEnd) {
    // Update existing entry from database, but keep timestamp at end of day
    const existingEntry = dbEntryToday[0];
    // Use currentDayEnd (23:59:59) for calculation, not currentTimestamp
    const { result7d, result14d, result30d, result365d, hasAnyApr } =
      await calculateRollingAprSeries(
        ctx,
        vault,
        currentExchangeRate,
        currentDayEnd,
        startApyCalculationTimestamp,
        portNavUpdates
      );

    if (hasAnyApr) {
      existingEntry.apy7d = result7d.apr ?? BigInt(0);
      existingEntry.apy14d = result14d.apr ?? BigInt(0);
      existingEntry.apy30d = result30d.apr ?? BigInt(0);
      existingEntry.apy365d = result365d.apr ?? BigInt(0);
      existingEntry.exchangeRate = currentExchangeRate;
      existingEntry.exchangeRate7dAgo = result7d.historicalER;
      existingEntry.exchangeRate14dAgo = result14d.historicalER;
      existingEntry.exchangeRate30dAgo = result30d.historicalER;
      existingEntry.exchangeRate365dAgo = result365d.historicalER;
      existingEntry.block = currentBlock;
      // Always store timestamp at end of day (23:59:59) for consistency
      existingEntry.timestamp = BigInt(currentDayEnd);
      portVaultApyCharts.set(existingEntry.id, existingEntry);
      return existingEntry;
    }
    return null;
  }

  // Create new entry for today at end of day (23:59:59)
  // Use currentDayEnd (23:59:59) for calculation, not currentTimestamp
  const { result7d, result14d, result30d, result365d, hasAnyApr } =
    await calculateRollingAprSeries(
      ctx,
      vault,
      currentExchangeRate,
      currentDayEnd,
      startApyCalculationTimestamp,
      portNavUpdates
    );

  if (hasAnyApr) {
    const chartId = `${vault.id}-${currentDayEnd}`;
    const portVaultApyChart = new PortVaultApyChart({
      id: chartId,
      vault: vault,
      apy7d: result7d.apr ?? BigInt(0),
      apy14d: result14d.apr ?? BigInt(0),
      apy30d: result30d.apr ?? BigInt(0),
      apy365d: result365d.apr ?? BigInt(0),
      timestamp: BigInt(currentDayEnd), // Always store at end of day (23:59:59)
      block: currentBlock,
      exchangeRate: currentExchangeRate,
      exchangeRate7dAgo: result7d.historicalER,
      exchangeRate14dAgo: result14d.historicalER,
      exchangeRate30dAgo: result30d.historicalER,
      exchangeRate365dAgo: result365d.historicalER,
    });
    portVaultApyCharts.set(chartId, portVaultApyChart);
    return portVaultApyChart;
  }

  return null;
}

async function updateAllVaultAPY(ctx: ProcessorContext, portVaults: Map<string, PortVault>, portVaultAPYs: Map<string, PortVaultAPY>): Promise<{ portVaults: Map<string, PortVault>, portVaultAPYs: Map<string, PortVaultAPY> }> {
  const currentBlockTimestamp = ctx.blocks[ctx.blocks.length - 1].header.timestamp;
  const currentTime = new Date(currentBlockTimestamp);
  const isSynced = ctx.isHead && ctx.blocks.length === 1;

  if (!isSynced) {
    return { portVaults, portVaultAPYs };
  }

  const timeSinceLastUpdate = LAST_AVG_APY_UPDATE ?
    (currentTime.getTime() - LAST_AVG_APY_UPDATE.getTime()) : null;
  const shouldUpdateAvgAPY = !LAST_AVG_APY_UPDATE ||
    (timeSinceLastUpdate && timeSinceLastUpdate >= AVG_APY_UPDATE_INTERVAL);

  if (!shouldUpdateAvgAPY) {
    return { portVaults, portVaultAPYs };
  }

  LAST_AVG_APY_UPDATE = currentTime;

  const vaultAddresses = Array.from(portVaults.keys());
  const allPortVaults = await ctx.store.find(PortVault, { where: { address: Not(In(vaultAddresses)), network: ctx.syncedNetwork }, relations: { baseToken: true } });
  const allPortVaultsMap = toEntityMap(allPortVaults, 'address');
  portVaults = new Map([...portVaults, ...allPortVaultsMap]);

  let errorCount = 0;

  for (const portVault of portVaults.values()) {
    try {
      // Only calculate average APY (main APY is handled in parseNavUpdate)
      const avg7dApy = await calculateAverageAPYForPeriod(ctx, portVault.address, 7, currentBlockTimestamp, portVaultAPYs);
      const avg30dApy = await calculateAverageAPYForPeriod(ctx, portVault.address, 30, currentBlockTimestamp, portVaultAPYs);
      const avg1yApy = await calculateAverageAPYForPeriod(ctx, portVault.address, 365, currentBlockTimestamp, portVaultAPYs);
      portVault.avg7dApy = avg7dApy;
      portVault.avg30dApy = avg30dApy;
      portVault.avg1yApy = avg1yApy;
      portVaults.set(portVault.address.toLowerCase(), portVault);
    } catch (error) {
      ctx.log.error(`[APY] ❌ Failed to calculate daily average APY for vault ${portVault.id}: ${error}`);
      errorCount++;
    }
  }

  return { portVaults, portVaultAPYs };
}

async function updateAllVaultApyCharts(
  ctx: ProcessorContext,
  portVaults: Map<string, PortVault>,
  portVaultApyCharts: Map<string, PortVaultApyChart>,
  config: Config
): Promise<{ portVaults: Map<string, PortVault>, portVaultApyCharts: Map<string, PortVaultApyChart> }> {
  const currentBlockTimestamp = ctx.blocks[ctx.blocks.length - 1].header.timestamp;
  const currentTime = new Date(currentBlockTimestamp);
  const isSynced = ctx.isHead && ctx.blocks.length === 1;

  if (!isSynced) {
    return { portVaults, portVaultApyCharts };
  }

  // Check if we've crossed into a new day
  const currentDayEnd = new Date(currentTime);
  currentDayEnd.setHours(23, 59, 59, 999);
  const yesterdayEnd = currentDayEnd.getTime() - (24 * 60 * 60 * 1000);
  const yesterdayStart = yesterdayEnd - (24 * 60 * 60 * 1000) + 1;

  // Only run if we're in a new day (at least 1 second past midnight)
  const currentDayStart = new Date(currentTime);
  currentDayStart.setHours(0, 0, 0, 0);
  const secondsSinceMidnight = (currentTime.getTime() - currentDayStart.getTime()) / 1000;
  if (secondsSinceMidnight < 1) {
    return { portVaults, portVaultApyCharts };
  }

  const lastUpdateDay = LAST_APY_CHART_UPDATE ? new Date(LAST_APY_CHART_UPDATE.getTime()) : null;
  lastUpdateDay?.setHours(23, 59, 59, 999);
  
  if (lastUpdateDay && lastUpdateDay.getTime() >= currentDayEnd.getTime()) {
    // Already ran today
    return { portVaults, portVaultApyCharts };
  }

  LAST_APY_CHART_UPDATE = currentTime;

  const vaultAddresses = Array.from(portVaults.keys());
  const allPortVaults = await ctx.store.find(PortVault, { 
    where: { address: Not(In(vaultAddresses)), network: ctx.syncedNetwork }, 
    relations: { baseToken: true } 
  });
  const allPortVaultsMap = toEntityMap(allPortVaults, 'address');
  portVaults = new Map([...portVaults, ...allPortVaultsMap]);

  let errorCount = 0;

  for (const portVault of portVaults.values()) {
    try {
      // Only calculate for STANDARD vaults
      if (portVault.type !== PortVaultType.STANDARD) {
        continue;
      }

      // Check if yesterday already has a chart entry (from NAV updates)
      const yesterdayDayStart = yesterdayEnd - (24 * 60 * 60 * 1000) + 1;
      const memEntryYesterday = Array.from(portVaultApyCharts.values()).find(
        chart => chart.vault?.address === portVault.address && 
                 Number(chart.timestamp) >= yesterdayDayStart && 
                 Number(chart.timestamp) <= yesterdayEnd
      );

      if (memEntryYesterday) {
        // Yesterday already has an entry from NAV updates, skip
        continue;
      }

      const dbEntryYesterday = await ctx.store.find(PortVaultApyChart, {
        where: {
          vault: { address: portVault.address, network: ctx.syncedNetwork },
          timestamp: MoreThanOrEqual(BigInt(yesterdayDayStart)),
        },
        order: { timestamp: 'ASC' },
        take: 1
      });

      if (dbEntryYesterday.length > 0 && Number(dbEntryYesterday[0].timestamp) <= yesterdayEnd) {
        // Yesterday already has an entry, skip
        continue;
      }

      // Yesterday doesn't have an entry, create one using the most recent NAV update
      const navBeforeYesterday = await ctx.store.find(PortNavUpdate, {
        where: {
          vault: { address: portVault.address, network: ctx.syncedNetwork },
          timestamp: LessThanOrEqual(BigInt(yesterdayEnd)),
        },
        order: { timestamp: 'DESC' },
        take: 1
      });

      if (navBeforeYesterday.length === 0) {
        continue;
      }

      const navUpdate = navBeforeYesterday[0];
      // Use current NAV from vault entity as the exchange rate for yesterday
      const exchangeRateForYesterday = portVault.currentNav;

      // Use current NAV for APR calculation
      // This calculates APR as of yesterday by comparing current rate to 7/14/30/365 days before yesterday
      const startApyCalculationTimestamp = config.Port?.Vaults?.find((v) => v.address.toLowerCase() == portVault.address.toLowerCase())?.StartApyCalculationTimestamp;
      const { result7d, result14d, result30d, result365d, hasAnyApr } =
        await calculateRollingAprSeries(
          ctx,
          portVault,
          exchangeRateForYesterday,
          yesterdayEnd,
          startApyCalculationTimestamp
        );

      if (hasAnyApr) {
        const chartId = `${portVault.id}-${yesterdayEnd}`;
        const portVaultApyChart = new PortVaultApyChart({
          id: chartId,
          vault: portVault,
          apy7d: result7d.apr ?? BigInt(0),
          apy14d: result14d.apr ?? BigInt(0),
          apy30d: result30d.apr ?? BigInt(0),
          apy365d: result365d.apr ?? BigInt(0),
          timestamp: BigInt(yesterdayEnd), // Store at end of day (23:59:59)
          block: navUpdate.block,
          exchangeRate: exchangeRateForYesterday,
          exchangeRate7dAgo: result7d.historicalER,
          exchangeRate14dAgo: result14d.historicalER,
          exchangeRate30dAgo: result30d.historicalER,
          exchangeRate365dAgo: result365d.historicalER,
        });
        portVaultApyCharts.set(chartId, portVaultApyChart);
      }
    } catch (error) {
      ctx.log.error(`[APY Chart] ❌ Failed to calculate daily rolling APY chart for vault ${portVault.id}: ${error}`);
      errorCount++;
    }
  }

  return { portVaults, portVaultApyCharts };
}

async function updateExpiredWithdrawalRequests(ctx: ProcessorContext, portWithdrawalRequests: Map<string, PortWithdrawalRequest>, portVaults: Map<string, PortVault>): Promise<{ portWithdrawalRequests: Map<string, PortWithdrawalRequest>, portVaults: Map<string, PortVault> }> {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;
  const currentTimestamp = BigInt(ctx.blocks[ctx.blocks.length - 1].header.timestamp);

  if (!isSynced || portVaults.size >= 1 || portWithdrawalRequests.size >= 1) {
    return { portWithdrawalRequests, portVaults };
  }

  const expiredWithdrawalRequests = await ctx.store.find(PortWithdrawalRequest, { where: { status: PortWithdrawalRequestStatus.PENDING, deadline: LessThan(currentTimestamp), vault: { network: ctx.syncedNetwork } }, relations: { vault: true } });

  for (const withdrawalRequest of expiredWithdrawalRequests) {
    const portVault = portVaults.get(withdrawalRequest.vault.address) ?? await getPortVaultByAddress(ctx, withdrawalRequest.vault.address);
    if (!portVault) {
      continue;
    }

    withdrawalRequest.status = PortWithdrawalRequestStatus.EXPIRED;
    portWithdrawalRequests.set(withdrawalRequest.id, withdrawalRequest);

    portVault.totalPendingWithdrawalRequests = portVault.totalPendingWithdrawalRequests - BigInt(1);
    portVault.totalWithdrawalRequestsInBaseToken = portVault.totalWithdrawalRequestsInBaseToken - withdrawalRequest.offerAmount;
    portVaults.set(portVault.address.toLowerCase(), portVault);
  }

  return { portWithdrawalRequests, portVaults };
}

async function calculateVaultTvlAtBlock(
  ctx: ProcessorContext,
  portVault: PortVault,
  blockHeight: number
): Promise<bigint> {
  const updatedNav = await readContract(ctx, portVault.accountant, AccountantAbi, 'getRate', [], blockHeight);
  const navInBaseToken = convertToBaseTokenAmount(BigInt(updatedNav), BigInt(portVault.baseToken.decimals), BigInt(18));
  const totalSupply = await readContract(ctx, portVault.address, BoringVaultAbi, 'totalSupply', [], blockHeight);
  let tvl = (totalSupply * navInBaseToken) / BigInt(10 ** portVault.decimals);

  const baseToken = await tokensService.getTokenByAddress(ctx, portVault.baseToken.address);
  if (baseToken) {
    const priceInBN = calculateUsdPriceInBN(BigInt(10 ** Number(baseToken.decimals)), baseToken.price, BigInt(baseToken.decimals));
    tvl = (tvl * priceInBN) / BigInt(10 ** Number(baseToken.decimals));
  } else {
    throwError(`Base token not found - calculateVaultTvlAtBlock failed.`, portVault.id);
  }

  return tvl;
}

async function updateAllVaultTvl(ctx: ProcessorContext, portVaults: Map<string, PortVault>, config: Config): Promise<{ portVaults: Map<string, PortVault> }> {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;

  if (!isSynced) {
    return { portVaults };
  }

  const vaultsDB = await ctx.store.find(PortVault, { where: { address: Not(In(Array.from(portVaults.keys()))), network: ctx.syncedNetwork }, relations: { baseToken: true } });
  const vaultsDBMap = toEntityMap(vaultsDB, 'address');
  portVaults = new Map([...portVaults, ...vaultsDBMap]);

  for (const portVault of portVaults.values()) {
    const updatedNav = await readContract(ctx, portVault.accountant, AccountantAbi, 'getRate', [], ctx.blocks[ctx.blocks.length - 1].header.height);
    portVault.currentNav = updatedNav;

    if (portVault.type === PortVaultType.STANDARD) {
      const startApyCalculationTimestamp = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == portVault.address.toLowerCase())?.StartApyCalculationTimestamp;
      portVault.apy = await calculateAPRFromRate(ctx, new PortNavUpdate({
        id: `${portVault.address}-${updatedNav}-${ctx.blocks[ctx.blocks.length - 1].header.height}`,
        vault: portVault,
        newRate: BigInt(updatedNav),
        oldRate: BigInt(updatedNav),
        timestamp: BigInt(ctx.blocks[ctx.blocks.length - 1].header.timestamp),
      }), portVault, startApyCalculationTimestamp);
    }

    portVault.tvl = await calculateVaultTvlAtBlock(ctx, portVault, ctx.blocks[ctx.blocks.length - 1].header.height);
    portVaults.set(portVault.address.toLowerCase(), portVault);
  }

  return { portVaults };
}

function createPortVaultId(address: string, ctx: ProcessorContext): string {
  return `${address.toLowerCase()}-${ctx.syncedNetwork}`;
}

export const portService = {
  initializePort,
  updateAllVaultAPY,
  updateAllVaultApyCharts,
  updateExpiredWithdrawalRequests,
  updateAllVaultTvl,
  createPortVaultId,
  getGlobalStats,
  getPortVaultByAddress,
  calculateAPRFromRate,
  calculateAverageAPYForPeriod,
  calculateRollingAPR,
  calculateVaultTvlAtBlock,
  getOrCreateDailyChartEntry,
}
