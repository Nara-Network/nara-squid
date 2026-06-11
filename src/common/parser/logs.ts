import {
  User,
  PortVault,
  PortDeposit,
  PortWithdrawalRequest,
  PortVaultStatusUpdate,
  PortVaultStatus,
  PortNavUpdate,
  PortRequestFulfilled,
  PortVaultActivity,
  PortVaultTransactionHistory,
  PortVaultAPY,
  PortVaultApyChart,
  FundsReverted,
  FundsDiverted,
  ExpectedExchangeRate,
  ExpectedExchangeRateSnapshot,
  ManagerWithdraw,
  ManagerDeposit,
  BorrowedAssetBalance,
  BlockBatchAudit,
  NaraGlobalStats,
  NaraSupplyChartPoint,
  NaraTvlChartPoint,
  NaraApyChartPoint,
  NaraRedemption,
  NaraRedemptionActivity,
  TotalRequestedAmount,
  Network,
} from '../../model';
import { ProcessorContext } from '../dataSet';

import * as BoringVaultAbi from '../../abi/BoringVault';
import * as AtomicQueueAbi from '../../abi/AtomicQueue';
import * as AccountantAbi from '../../abi/AccountantWithRateProviders';
import * as TellerAbi from '../../abi/TellerWithMultiAssetSupport';
import * as AaveV3PoolAbi from '../../abi/AaveV3Pool';
import * as CompoundUSDCAbi from '../../abi/CompoundUSDC';
import * as ERC20Abi from '../../abi/ERC20';
import * as NaraUSD from '../../abi/NaraUSD';

import { Config } from '../types';

import { getTrackedTokenAddress, initializeTokens } from '../mapping/baseTokens';
import { portService } from '../../services/port';
import { strategyService } from '../../services/strategy';
import { getVaultAddressFromTransferLog } from '../../helpers/eer';
import { parserService } from '../../services/parser';
import { eerService } from '../../services/eer';
import { naraService } from '../../services/nara';
import { transparencyService } from '../../services/transparency';

function getActiveVaults(config: Config, blockHeight: number) {
  return config.Port?.Vaults?.filter((vault) => vault.block <= blockHeight) ?? []
}

function shouldIncludeAllBlocks(): boolean {
  return process.env.INCLUDE_ALL_BLOCKS !== 'false';
}

export async function parseContext(
  ctx: ProcessorContext,
  config: Config,
  syncedBlocksInterval: number,
  batchSizeMulticall: number,
  poolSizeSyncTsDelay: number
): Promise<void> {
  await initializeTokens(ctx)

  let users: Map<string, User> = new Map()
  let portVaults: Map<string, PortVault> = new Map()
  let portDeposits: Map<string, PortDeposit> = new Map()
  let portWithdrawalRequests: Map<string, PortWithdrawalRequest> = new Map()
  let portRequestFulfilleds: Map<string, PortRequestFulfilled> = new Map()
  let portVaultActivities: Map<string, PortVaultActivity> = new Map()
  let portVaultStatusUpdates: Map<string, PortVaultStatusUpdate> = new Map()
  let portNavUpdates: Map<string, PortNavUpdate> = new Map()
  let portGlobalStats = await portService.getGlobalStats(ctx)
  let portVaultTransactionHistories: Map<string, PortVaultTransactionHistory> = new Map()
  let portVaultAPYs: Map<string, PortVaultAPY> = new Map()
  let portVaultApyCharts: Map<string, PortVaultApyChart> = new Map()
  let fundsDiverted: Map<string, FundsDiverted> = new Map()
  let fundsReverted: Map<string, FundsReverted> = new Map()
  let expectedExchangeRates: Map<string, ExpectedExchangeRate> = new Map()
  let managerWithdraws: Map<string, ManagerWithdraw> = new Map()
  let managerDeposits: Map<string, ManagerDeposit> = new Map()
  let borrowedBalances: Map<string, BorrowedAssetBalance> = new Map()
  let snapshots: Map<string, ExpectedExchangeRateSnapshot> = new Map()
  let naraGlobalStats: NaraGlobalStats = await naraService.getGlobalStats(ctx)
  let naraSupplyChartPoints: Map<string, NaraSupplyChartPoint> = new Map()
  let naraTvlChartPoints: Map<string, NaraTvlChartPoint> = new Map()
  let naraApyChartPoints: Map<string, NaraApyChartPoint> = new Map()
  let naraRedemptions: Map<string, NaraRedemption> = new Map()
  let naraRedemptionActivities: Map<string, NaraRedemptionActivity> = new Map()
  let totalRequestedAmounts: Map<string, TotalRequestedAmount> = new Map()
  const naraUsdAddress = ctx.syncedNetwork === Network.BSC
    ? undefined
    : getTrackedTokenAddress(ctx.syncedNetwork, 'NaraUSD')

    // Initialize port
    ; ({ portVaults, expectedExchangeRates } = await portService.initializePort({
      portVaults,
      expectedExchangeRates,
      config,
      ctx,
    }))

  if (ctx.isHead && ctx.blocks.length === 1) {
    ctx.log.info(`******* CHAIN SYNCED *******`)
  }

  ctx.log.info(
    `entrance block ${ctx.blocks[0].header.height} and final is ${ctx.blocks[ctx.blocks.length - 1].header.height} | ${ctx.blocks.length} blocks`
  )

  const batchStartTime = Date.now()
  const sortedBlocks = [...ctx.blocks].sort((a, b) => a.header.height - b.header.height)
  const firstHeight = sortedBlocks[0].header.height
  const lastHeight = sortedBlocks[sortedBlocks.length - 1].header.height
  const actualCount = sortedBlocks.length
  const includeAllBlocks = shouldIncludeAllBlocks()
  const expectedCount = includeAllBlocks ? lastHeight - firstHeight + 1 : actualCount

  if (includeAllBlocks) {
    for (let i = 1; i < sortedBlocks.length; i++) {
      const prevHeight = sortedBlocks[i - 1].header.height
      const currHeight = sortedBlocks[i].header.height
      if (currHeight !== prevHeight + 1) {
        const missingCount = currHeight - prevHeight - 1
        ctx.log.error(
          `BLOCK_GAP_DETECTED prev=${prevHeight} next=${currHeight} missing=${missingCount}`
        )
        if (process.env.BLOCK_GAP_STRICT_MODE === 'true') {
          throw new Error(
            `Block gap detected: prev=${prevHeight} next=${currHeight} missing=${missingCount}`
          )
        }
      }
    }
  } else {
    ctx.log.info(
      `FILTERED_BATCH_BLOCKS first=${firstHeight} last=${lastHeight} delivered=${actualCount}`
    )
  }

  const batchAuditId = `${ctx.syncedNetwork}-${firstHeight}-${batchStartTime}`
  const batchAudit = new BlockBatchAudit({
    id: batchAuditId,
    network: ctx.syncedNetwork,
    firstHeight: BigInt(firstHeight),
    lastHeight: BigInt(lastHeight),
    count: actualCount,
    expectedCount: expectedCount,
    startedAt: BigInt(batchStartTime),
    finishedAt: BigInt(0), 
  })

  let syncedBlock = sortedBlocks[0].header.height

  for (let i = 0; i < sortedBlocks.length; i++) {
    let block = sortedBlocks[i]
    let nextBlock = sortedBlocks[i + 1]
    const activeVaults = getActiveVaults(config, block.header.height)
    const activeAaveStrategy =
      config.Port?.Strategies?.AAVE && config.Port.Strategies.AAVE.block <= block.header.height
        ? config.Port.Strategies.AAVE
        : undefined
    const activeCompoundStrategy =
      config.Port?.Strategies?.COMPOUND && config.Port.Strategies.COMPOUND.block <= block.header.height
        ? config.Port.Strategies.COMPOUND
        : undefined
    const activeClearpoolStrategies =
      config.Port?.Strategies?.CLEARPOOL?.filter((strategy) => strategy.block <= block.header.height) ?? []

    for (let log of block.logs) {
      if (activeVaults.some((vault) => vault.address.toLowerCase() == log.address)) {
        switch (log.topics[0]) {
          case BoringVaultAbi.events.Enter.topic: {
            ; ({ portDeposits, users, portVaults, portGlobalStats, portVaultTransactionHistories } =
              await parserService.parseVaultEnter(
                ctx,
                log,
                config,
                portDeposits,
                users,
                portVaults,
                portGlobalStats,
                portVaultTransactionHistories,
              ))
            break
          }
        }
      }

      if (activeVaults.some((vault) => vault.AtomicQueue.toLowerCase() == log.address)) {
        switch (log.topics[0]) {
          case AtomicQueueAbi.events.AtomicRequestUpdated.topic: {
            ; ({ portWithdrawalRequests, users, portVaults, portVaultTransactionHistories } =
              await parserService.parseAtomicRequestUpdated(
                ctx,
                log,
                portWithdrawalRequests,
                users,
                portVaults,
                portVaultTransactionHistories
              ))
            break
          }

          case AtomicQueueAbi.events.AtomicRequestFulfilled.topic: {
            ; ({
              portWithdrawalRequests,
              users,
              portVaults,
              portRequestFulfilleds,
              portVaultTransactionHistories,
              portGlobalStats,
            } = await parserService.parseAtomicRequestFulfilled(
              ctx,
              log,
              config,
              portRequestFulfilleds,
              portWithdrawalRequests,
              users,
              portVaults,
              portVaultTransactionHistories,
              portGlobalStats,
            ))
            break
          }
        }
      }

      if (activeVaults.some((vault) => vault.Teller.toLowerCase() == log.address)) {
        switch (log.topics[0]) {
          case TellerAbi.events.Paused.topic: {
            ; ({ portVaults, portVaultStatusUpdates, portVaultActivities } = await parserService.parseVaultStatusUpdate(
              ctx,
              log,
              config,
              portVaults,
              PortVaultStatus.PAUSED,
              portVaultStatusUpdates,
              portVaultActivities
            ))
            break
          }

          case TellerAbi.events.Unpaused.topic: {
            ; ({ portVaults, portVaultStatusUpdates, portVaultActivities } = await parserService.parseVaultStatusUpdate(
              ctx,
              log,
              config,
              portVaults,
              PortVaultStatus.ACTIVE,
              portVaultStatusUpdates,
              portVaultActivities
            ))
            break
          }

          case TellerAbi.events.AssetAdded.topic: {
            ; ({ portVaults } = await parserService.parseAssetAdded(ctx, log, config, portVaults))
            break
          }

          case TellerAbi.events.AssetRemoved.topic: {
            ; ({ portVaults } = await parserService.parseAssetRemoved(ctx, log, config, portVaults))
            break
          }

          case TellerAbi.events.DepositCapUpdated.topic: {
            ; ({ portVaults, portVaultActivities } = await parserService.parseDepositCapUpdated(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities
            ))
            break
          }
        }
      }

      if (activeVaults.some((vault) => vault.Accountant.toLowerCase() == log.address)) {
        switch (log.topics[0]) {
          case AccountantAbi.events.ExchangeRateUpdated.topic: {
            ; ({ portNavUpdates, portVaults, portVaultActivities, portVaultAPYs, portVaultApyCharts } = await parserService.parseNavUpdate(
              ctx,
              log,
              config,
              portNavUpdates,
              portVaults,
              portVaultActivities,
              portVaultAPYs,
              portVaultApyCharts
            ))
            break
          }

          case AccountantAbi.events.LendingRateUpdated.topic: {
            ; ({ portVaults, portVaultActivities, portVaultAPYs } = await parserService.parseLendingRateUpdated(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              portVaultAPYs
            ))
            break
          }

          case AccountantAbi.events.ManagementFeeRateUpdated.topic: {
            ; ({ portVaults, portVaultActivities } = await parserService.parseManagementFeeUpdated(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              true
            ))
            break
          }

          case AccountantAbi.events.FeesClaimed.topic: {
            ; ({ portVaults, portVaultActivities } = await parserService.parseFeesClaimed(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              true,
            ))
            break
          }
        }
      }

      if (activeAaveStrategy?.address.toLowerCase() == log.address) {
        switch (log.topics[0]) {
          case AaveV3PoolAbi.events.Supply.topic: {
            ; ({ portVaults, portVaultActivities, fundsDiverted } = await parserService.parseFundsDiverted(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              fundsDiverted,
            ))
            break
          }

          case AaveV3PoolAbi.events.Withdraw.topic: {
            ; ({ portVaults, portVaultActivities, fundsReverted } = await parserService.parseFundsReverted(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              fundsReverted,
            ))
            break
          }
        }
      }

      if (activeClearpoolStrategies.some((strategy) => strategy.address.toLowerCase() == log.address)) {
        switch (log.topics[0]) {
          case BoringVaultAbi.events.Enter.topic: {
            ; ({
              portVaults,
              portVaultActivities,
              fundsDiverted,
            } = await parserService.parseFundsDivertedToClearpool(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              fundsDiverted,
            ))
            break
          }
        }
      }

      if (activeClearpoolStrategies.some((strategy) => strategy.AtomicQueue.toLowerCase() == log.address)) {
        switch (log.topics[0]) {
          case AtomicQueueAbi.events.AtomicRequestFulfilled.topic: {
            ; ({
              portVaults,
              portVaultActivities,
              fundsReverted,
            } = await parserService.parseFundsRevertedFromClearpool(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              fundsReverted,
            ))
            break
          }
        }
      }

      if (activeCompoundStrategy?.address.toLowerCase() == log.address) {
        switch (log.topics[0]) {
          case CompoundUSDCAbi.events.Supply.topic: {
            ; ({
              portVaults,
              portVaultActivities,
              fundsDiverted,
            } = await parserService.parseFundsDivertedToCompound(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              fundsDiverted,
            ))
            break
          }

          case CompoundUSDCAbi.events.Withdraw.topic: {
            ; ({
              portVaults,
              portVaultActivities,
              fundsReverted,
            } = await parserService.parseFundsRevertedFromCompound(
              ctx,
              log,
              config,
              portVaults,
              portVaultActivities,
              fundsReverted,
            ))
            break
          }
        }
      }

      if (log.topics[0] === ERC20Abi.events.Transfer.topic) {
        const vaultAddress = getVaultAddressFromTransferLog(config, log, block.header.height);
        const isRequestFulfilled = block.logs.some(l => l.topics[0] === AtomicQueueAbi.events.AtomicRequestFulfilled.topic);
        if (vaultAddress && !isRequestFulfilled) {
          ; ({ portVaults, managerWithdraws, managerDeposits, portVaultActivities } = await parserService.parseBorrowerTransfer(
            ctx,
            log,
            config,
            vaultAddress,
            portVaults,
            managerWithdraws,
            managerDeposits,
            portVaultActivities
          ))
        }
      }

      if (naraUsdAddress && log.address === naraUsdAddress.toLowerCase()) {
        switch (log.topics[0]) {
          case NaraUSD.events.Redeem.topic:
          case NaraUSD.events.RedemptionRequested.topic:
          case NaraUSD.events.RedemptionCompleted.topic: {
            ; ({ users, naraRedemptions, naraRedemptionActivities, totalRequestedAmounts } = await parserService.parseNaraRedemptionActivity(
              ctx,
              log,
              users,
              naraRedemptions,
              naraRedemptionActivities,
              totalRequestedAmounts,
            ))
            break
          }
        }
      }
    }

    ; ({ portVaults, expectedExchangeRates, snapshots } = await eerService.updateExpectedExchangeRateForVaults(
      ctx,
      portVaults,
      expectedExchangeRates,
      snapshots,
      config,
      borrowedBalances,
      block.header.height,
      block.header.timestamp,
    ))

    if (!ctx.isHead && transparencyService.shouldCaptureDailySnapshot(block.header.timestamp, nextBlock?.header.timestamp)) {
      ; ({
        naraSupplyChartPoints,
        naraTvlChartPoints,
        naraApyChartPoints,
      } = await transparencyService.captureDailySnapshotsForBlock({
        ctx,
        config,
        blockHeight: block.header.height,
        blockTimestamp: block.header.timestamp,
        portVaults,
        naraSupplyChartPoints,
        naraTvlChartPoints,
        naraApyChartPoints,
      }))
    }

    if (ctx.isHead && ctx.blocks.length === 1) {
      ; ({
        naraSupplyChartPoints,
        naraTvlChartPoints,
        naraApyChartPoints,
      } = await transparencyService.refreshLatestNaraSnapshotsIfDue({
        ctx,
        config,
        blockHeight: block.header.height,
        blockTimestamp: block.header.timestamp,
        portVaults,
        naraSupplyChartPoints,
        naraTvlChartPoints,
        naraApyChartPoints,
      }))
    }

    syncedBlock += syncedBlocksInterval
  }

  ({ portWithdrawalRequests, portVaults } = await portService.updateExpiredWithdrawalRequests(
    ctx,
    portWithdrawalRequests,
    portVaults
  ));

  ({ portVaults, portVaultAPYs } = await portService.updateAllVaultAPY(ctx, portVaults, portVaultAPYs));

  ({ portVaults, portVaultApyCharts } = await portService.updateAllVaultApyCharts(ctx, portVaults, portVaultApyCharts, config));

  ({ portVaults } = await portService.updateAllVaultTvl(ctx, portVaults, config))

  naraSupplyChartPoints = await transparencyService.backfillNaraSupplyChartPoints({
    ctx,
    config,
    naraSupplyChartPoints,
  });

  naraApyChartPoints = await transparencyService.backfillNaraApyChartPoints({
    ctx,
    config,
    naraApyChartPoints,
  });

  naraGlobalStats = await naraService.updateGlobalStats(ctx, config, naraGlobalStats, portVaults, portNavUpdates)

  await ctx.store.upsert([...users.values()])
  await ctx.store.upsert([...portVaults.values()])
  
  const lastBlock = ctx.blocks[ctx.blocks.length - 1]
  await strategyService.refreshStrategySnapshotsDaily(ctx, portVaults, config, lastBlock.header.height, lastBlock.header.timestamp)
  await ctx.store.upsert([...expectedExchangeRates.values()])
  await ctx.store.upsert([...portDeposits.values()])
  await ctx.store.upsert([...portWithdrawalRequests.values()])
  await ctx.store.upsert([...portRequestFulfilleds.values()])
  await ctx.store.upsert([...portVaultActivities.values()])
  await ctx.store.upsert([...portVaultStatusUpdates.values()])
  await ctx.store.upsert([...portNavUpdates.values()])
  await ctx.store.upsert([...portVaultTransactionHistories.values()])
  await ctx.store.upsert([...portVaultAPYs.values()])
  await ctx.store.upsert([...portVaultApyCharts.values()])
  await ctx.store.upsert([...fundsDiverted.values()])
  await ctx.store.upsert([...fundsReverted.values()])
  await ctx.store.upsert([...managerWithdraws.values()])
  await ctx.store.upsert([...managerDeposits.values()])
  await ctx.store.upsert([...borrowedBalances.values()])
  await ctx.store.upsert([...snapshots.values()])
  await ctx.store.upsert([...naraSupplyChartPoints.values()])
  await ctx.store.upsert([...naraTvlChartPoints.values()])
  await ctx.store.upsert([...naraApyChartPoints.values()])
  await ctx.store.upsert([...naraRedemptions.values()])
  await ctx.store.upsert([...naraRedemptionActivities.values()])
  await ctx.store.upsert([...totalRequestedAmounts.values()])

  await ctx.store.upsert(portGlobalStats)
  await ctx.store.upsert(naraGlobalStats)

  batchAudit.finishedAt = BigInt(Date.now())
  await ctx.store.upsert(batchAudit)
}

