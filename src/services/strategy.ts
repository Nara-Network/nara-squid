import { ProcessorContext } from '../common/dataSet'
import { Config, Strategy } from '../common/types'
import { PortVault, StrategyPositionSnapshot } from '../model'
import * as AaveV3PoolAbi from '../abi/AaveV3Pool'
import * as CompoundUSDCAbi from '../abi/CompoundUSDC'
import { readContract } from '../helpers/common'
import { portService } from './port'
import { pow10, safeMulDiv } from '../common/utils/number'
import { dayStart, toSec } from '../common/utils/time'

import * as BoringVaultAbi from '../abi/BoringVault';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import * as ERC20Abi from '../abi/ERC20';

const LAST_DAILY_STRATEGY_READ_TS_BY_NETWORK = new Map<string, number>()

/**
 * Maximum age (in hours) for a strategy snapshot to be considered fresh.
 * Snapshots older than this will be ignored and EER will fallback to investedBaseTracked.
 * 
 * For production: 12 hours (allows daily snapshots with some tolerance)
 * For testing: 1-2 hours (allows frequent snapshots with tolerance for drift)
 */
export const STRATEGY_SNAPSHOT_MAX_AGE_HOURS = 12

/**
 * Read Clearpool position value (mark-to-market)
 * Clearpool vaults are BoringVaults, so we read balanceOf (shares) and convert to assets using Clearpool vault's NAV
 * 
 * IMPORTANT: Proper decimal conversion:
 * - sharesRaw is in Clearpool vault share units (10^cpShareDec)
 * - cpNavWad is WAD (1e18) = assets per share in human units
 * - We want result in parent vault's base token raw units (10^baseDec)
 * 
 * Formula: assetsRaw = sharesRaw * cpNavWad * 10^baseDec / (1e18 * 10^cpShareDec)
 * 
 * Returns balance in base token raw units
 */
async function readClearpoolPositionValue(
  ctx: ProcessorContext,
  vault: PortVault,
  clearpoolStrategy: Strategy & { AtomicQueue: string },
  blockHeight: number
): Promise<bigint> {
  
  try {
    // Check if Clearpool vault exists at this block (deployment block check)
    if (blockHeight < clearpoolStrategy.block) {
      return 0n
    }
    
    // Clearpool vault is a BoringVault, read balanceOf (returns shares in cpShareDec units)
    const sharesRaw = BigInt(await readContract(
      ctx,
      clearpoolStrategy.address,
      BoringVaultAbi,
      'balanceOf',
      { _0: vault.address },
      blockHeight
    ))
    
    if (sharesRaw === 0n) {
      return 0n
    }
    
    // Get parent vault's base token decimals
    const baseDec = Number(vault.baseToken.decimals)
    
    // Try to read Clearpool vault as a PortVault to get its accountant and decimals
    const clearpoolVault = await portService.getPortVaultByAddress(ctx, clearpoolStrategy.address.toLowerCase())
    
    if (clearpoolVault && clearpoolVault.accountant) {
      // Get Clearpool vault's share decimals
      const cpShareDec = Number(clearpoolVault.decimals)
      
      // Read Clearpool vault's NAV from its accountant (WAD = 1e18)
      const cpNavWad = BigInt(await readContract(
        ctx,
        clearpoolVault.accountant,
        AccountantAbi,
        'getRate',
        [],
        blockHeight
      ))
      
      // Convert shares to assets with proper decimal handling:
      // assetsRaw = sharesRaw * cpNavWad * 10^baseDec / (1e18 * 10^cpShareDec)
      // 
      // This can be rewritten as:
      // assetsRaw = sharesRaw * cpNavWad / 10^(18 + cpShareDec - baseDec)
      const divisorExp = 18 + cpShareDec - baseDec
      const assetsRaw = divisorExp >= 0
        ? safeMulDiv(sharesRaw, cpNavWad, pow10(divisorExp))
        : sharesRaw * cpNavWad * pow10(-divisorExp)
      
      ctx.log.info(
        `[Clearpool Position] vault=${vault.address} clearpoolVault=${clearpoolStrategy.address} ` +
        `sharesRaw=${sharesRaw.toString()} cpShareDec=${cpShareDec} baseDec=${baseDec} ` +
        `cpNavWad=${cpNavWad.toString()} (${(Number(cpNavWad) / 1e18).toFixed(6)}) ` +
        `assetsRaw=${assetsRaw.toString()} (${(Number(assetsRaw) / Number(pow10(baseDec))).toFixed(6)})`
      )
      
      return assetsRaw
    } else {
      // Clearpool vault not found in our database
      // Try to read decimals directly from the contract
      try {
        const cpShareDec = Number(await readContract(
          ctx,
          clearpoolStrategy.address,
          BoringVaultAbi,
          'decimals',
          [],
          blockHeight
        ))
        
        // We need the accountant address to get NAV - check config for it
        // Since we can't get NAV without accountant, log warning
        ctx.log.warn(
          `[Clearpool Position] Clearpool vault ${clearpoolStrategy.address} not found in database. ` +
          `Cannot get accountant to read NAV. vault=${vault.address} sharesRaw=${sharesRaw.toString()} cpShareDec=${cpShareDec}`
        )
        
        // Return 0 since we can't properly convert without NAV
        // Returning shares would be dimensionally wrong
        return 0n
      } catch (decError) {
        ctx.log.warn(
          `[Clearpool Position] Clearpool vault ${clearpoolStrategy.address} not found and failed to read decimals. ` +
          `vault=${vault.address} sharesRaw=${sharesRaw.toString()}`
        )
        return 0n
      }
    }
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    if (errorMsg.includes('empty result') || errorMsg.includes('failed') || errorMsg.includes('revert')) {
      if (blockHeight >= clearpoolStrategy.block) {
        ctx.log.warn(`[Clearpool Position] Contract call failed for vault=${vault.address} at block=${blockHeight}: ${errorMsg}`)
      }
      return 0n
    }
    ctx.log.warn(`[Clearpool Position] Unexpected error reading Clearpool position for vault=${vault.address} at block=${blockHeight}: ${errorMsg}`)
    return 0n
  }
}

/**
 * Read Compound position value (mark-to-market including accrued interest)
 * Returns balance in base token units
 */
async function readCompoundPositionValue(
  ctx: ProcessorContext,
  vault: PortVault,
  compoundStrategy: Strategy,
  blockHeight: number
): Promise<bigint> {
  try {
    // Check if Compound strategy exists at this block (deployment block check)
    if (blockHeight < compoundStrategy.block) {
      return 0n
    }
    
    // Compound's balanceOf includes accrued interest
    const balance = BigInt(await readContract(
      ctx,
      compoundStrategy.address,
      CompoundUSDCAbi,
      'balanceOf',
      { account: vault.address },
      blockHeight
    ))
    
    // Compound balance is already in base token units
    return balance
  } catch (error) {
    ctx.log.warn(`[Compound Position] Failed to read Compound position for vault=${vault.address} at block=${blockHeight}: ${error}`)
    return 0n
  }
}

/**
 * Read Aave position value (mark-to-market including accrued interest)
 * Returns balance in base token units (normalized to baseToken decimals)
 * 
 * Uses Pool.getReserveData(asset) to get aTokenAddress from the returned struct,
 * then reads aToken.balanceOf(vault) which includes accrued interest.
 * Falls back to getReserveAToken if getReserveData fails.
 */
async function readAavePositionValue(
  ctx: ProcessorContext,
  vault: PortVault,
  aaveStrategy: Strategy,
  blockHeight: number
): Promise<bigint> {
  try {
    // Check if Aave strategy exists at this block (deployment block check)
    if (blockHeight < aaveStrategy.block) {
      return 0n
    }
    
    let aTokenAddress: string | null = null
    
    // Try getReserveData first (returns full struct with aTokenAddress)
    try {
      const reserveData = await readContract(
        ctx,
        aaveStrategy.address,
        AaveV3PoolAbi,
        'getReserveData',
        { asset: aaveStrategy.asset },
        blockHeight
      )
      aTokenAddress = reserveData.aTokenAddress
      
    } catch (reserveDataError: any) {
      // Fallback to getReserveAToken
      try {
        aTokenAddress = await readContract(
          ctx,
          aaveStrategy.address,
          AaveV3PoolAbi,
          'getReserveAToken',
          { asset: aaveStrategy.asset },
          blockHeight
        )
        
      } catch (aTokenError: any) {
        ctx.log.warn(
          `[Aave Position] Both getReserveData and getReserveAToken failed for vault=${vault.address} ` +
          `pool=${aaveStrategy.address} asset=${aaveStrategy.asset}: ${aTokenError?.message || aTokenError}`
        )
        return 0n
      }
    }
    
    if (!aTokenAddress || aTokenAddress === '0x0000000000000000000000000000000000000000') {
      ctx.log.warn(
        `[Aave Position] Invalid aToken address: vault=${vault.address} ` +
        `asset=${aaveStrategy.asset} aTokenAddress=${aTokenAddress}`
      )
      return 0n
    }
    
    // Read aToken balance of vault (this includes accrued interest)
    const vaultATokenBalance = BigInt(await readContract(
      ctx,
      aTokenAddress,
      ERC20Abi,
      'balanceOf',
      { account: vault.address },
      blockHeight
    ))
    
    // IMPORTANT: Do NOT include manager balance here; it's not attributable per-vault and will be double-counted
    // Manager addresses are typically shared across many vaults (or can hold aggregated funds).
    // Adding manager balance would cause each vault snapshot to include the same manager balance,
    // massively inflating strategyValueBase for every vault and breaking EER calculations.
    // 
    // If funds are supplied "onBehalfOf=manager", you cannot safely attribute manager's balance
    // to individual vaults unless you have per-vault accounting (shares mapping, sub-accounts, or events).
    if (vault.manager) {
      const managerATokenBalance = BigInt(await readContract(
        ctx,
        aTokenAddress,
        ERC20Abi,
        'balanceOf',
        { account: vault.manager },
        blockHeight
      ))
      if (managerATokenBalance > 0n) {
        ctx.log.warn(
          `[Aave Position] Manager has aTokens; not counting them to avoid double-counting. ` +
          `vault=${vault.address} manager=${vault.manager} managerBal=${managerATokenBalance.toString()}`
        )
      }
    }
    
    // aToken balance is already in underlying asset decimals (aTokens are 1:1 with underlying)
    return vaultATokenBalance
  } catch (error: any) {
    const errorMsg = error?.message || String(error)
    ctx.log.warn(
      `[Aave Position] Failed to read Aave position for vault=${vault.address} at block=${blockHeight}: ${errorMsg}`
    )
    return 0n
  }
}

/**
 * Refresh strategy position snapshots daily (once per day per network).
 * Reads on-chain position values for all configured vault+strategy pairs.
 */
async function refreshStrategySnapshotsDaily(
  ctx: ProcessorContext,
  portVaults: Map<string, PortVault>,
  config: Config,
  blockHeight: number,
  blockTimestamp: number
): Promise<void> {
  const network = ctx.syncedNetwork
  const nowTsSec = toSec(blockTimestamp)
  const dayNow = dayStart(nowTsSec)

  // Gate check: only run once per day per network
  const lastDailyTs = LAST_DAILY_STRATEGY_READ_TS_BY_NETWORK.get(network) ?? 0
  if (dayNow <= lastDailyTs) {
    return // Already read today
  }

  // Update cache
  LAST_DAILY_STRATEGY_READ_TS_BY_NETWORK.set(network, dayNow)

  const strategies = config.Port?.Strategies
  if (!strategies) {
    return // No strategies configured
  }

  const vaults = config.Port?.Vaults ?? []
  if (vaults.length === 0) {
    return // No vaults configured
  }

  ctx.log.info(
    `[Strategy Position Snapshot] Starting daily refresh for network=${network} dayNow=${dayNow} block=${blockHeight}`
  )

  // Process each configured vault
  // Note: Vaults must be persisted before creating snapshots (called after vault persistence in parser)
  for (const vaultConfig of vaults) {
    const vaultAddr = vaultConfig.address.toLowerCase()
    
    // Load vault from map or DB
    // Note: Vaults should already be persisted at this point, but reload from DB to ensure relation is valid
    let vault = portVaults.get(vaultAddr)
    if (!vault) {
      const dbVault = await portService.getPortVaultByAddress(ctx, vaultAddr)
      if (!dbVault) {
        ctx.log.warn(
          `[Strategy Position Snapshot] Vault not found: ${vaultAddr}, skipping`
        )
        continue
      }
      vault = dbVault
      portVaults.set(vaultAddr, vault)
    } else {
      // Reload from DB to ensure vault is persisted and relation is valid
      const dbVault = await portService.getPortVaultByAddress(ctx, vaultAddr)
      if (dbVault) {
        vault = dbVault
        portVaults.set(vaultAddr, vault)
      } else {
        ctx.log.warn(
          `[Strategy Position Snapshot] Vault ${vaultAddr} not found in DB after persistence, skipping`
        )
        continue
      }
    }

    // Process AAVE strategy
    if (strategies.AAVE) {
      try {
        const positionValue = await readAavePositionValue(
          ctx,
          vault,
          strategies.AAVE,
          blockHeight
        )
        
        const snapshotId = `${vault.id}:${strategies.AAVE.address.toLowerCase()}`
        const snapshot = new StrategyPositionSnapshot({
          id: snapshotId,
          vault,
          strategyAddr: strategies.AAVE.address.toLowerCase(),
          lastReadTsSec: dayNow,
          valueBaseRaw: positionValue,
          principalBaseRaw: null,
          source: 'onchain_daily',
          blockHeight: BigInt(blockHeight),
          blockTimestampSec: nowTsSec,
          txHash: null,
        })

        await ctx.store.upsert(snapshot)
        
        ctx.log.info(
          `[Strategy Position Snapshot] AAVE vault=${vaultAddr} strategy=${strategies.AAVE.address} ` +
          `valueBaseRaw=${positionValue.toString()} dayNow=${dayNow}`
        )
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        ctx.log.error(
          `[Strategy Position Snapshot] Failed to create AAVE snapshot for vault=${vaultAddr} strategy=${strategies.AAVE.address}: ${errorMsg}`
        )
        // Continue with other strategies/vaults - don't abort entire transaction
      }
    }

    // Process COMPOUND strategy
    if (strategies.COMPOUND) {
      try {
        const positionValue = await readCompoundPositionValue(
          ctx,
          vault,
          strategies.COMPOUND,
          blockHeight
        )
        
        const snapshotId = `${vault.id}:${strategies.COMPOUND.address.toLowerCase()}`
        const snapshot = new StrategyPositionSnapshot({
          id: snapshotId,
          vault,
          strategyAddr: strategies.COMPOUND.address.toLowerCase(),
          lastReadTsSec: dayNow,
          valueBaseRaw: positionValue,
          principalBaseRaw: null,
          source: 'onchain_daily',
          blockHeight: BigInt(blockHeight),
          blockTimestampSec: nowTsSec,
          txHash: null,
        })

        await ctx.store.upsert(snapshot)
        
        ctx.log.info(
          `[Strategy Position Snapshot] COMPOUND vault=${vaultAddr} strategy=${strategies.COMPOUND.address} ` +
          `valueBaseRaw=${positionValue.toString()} dayNow=${dayNow}`
        )
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        ctx.log.error(
          `[Strategy Position Snapshot] Failed to create COMPOUND snapshot for vault=${vaultAddr} strategy=${strategies.COMPOUND.address}: ${errorMsg}`
        )
        // Continue with other strategies/vaults - don't abort entire transaction
      }
    }

    // Process CLEARPOOL strategies (array)
    const clearpools = strategies.CLEARPOOL ?? []
    for (const clearpoolStrategy of clearpools) {
      try {
        const positionValue = await readClearpoolPositionValue(
          ctx,
          vault,
          clearpoolStrategy,
          blockHeight
        )
        
        const snapshotId = `${vault.id}:${clearpoolStrategy.address.toLowerCase()}`
        const snapshot = new StrategyPositionSnapshot({
          id: snapshotId,
          vault,
          strategyAddr: clearpoolStrategy.address.toLowerCase(),
          lastReadTsSec: dayNow,
          valueBaseRaw: positionValue,
          principalBaseRaw: null,
          source: 'onchain_daily',
          blockHeight: BigInt(blockHeight),
          blockTimestampSec: nowTsSec,
          txHash: null,
        })

        await ctx.store.upsert(snapshot)
        
        ctx.log.info(
          `[Strategy Position Snapshot] CLEARPOOL vault=${vaultAddr} strategy=${clearpoolStrategy.address} ` +
          `valueBaseRaw=${positionValue.toString()} dayNow=${dayNow}`
        )
      } catch (error: any) {
        const errorMsg = error?.message || String(error)
        ctx.log.error(
          `[Strategy Position Snapshot] Failed to create CLEARPOOL snapshot for vault=${vaultAddr} ` +
          `strategy=${clearpoolStrategy.address}: ${errorMsg}`
        )
        // Continue with other strategies/vaults - don't abort entire transaction
      }
    }
  }

  ctx.log.info(
    `[Strategy Position Snapshot] Completed daily refresh for network=${network} dayNow=${dayNow}`
  )
}

/**
 * Get the latest strategy position value for a vault by summing all latest snapshots per strategy.
 * Only considers snapshots that are:
 * 1. At or before hourNow (no lookahead)
 * 2. Fresh (within STRATEGY_SNAPSHOT_MAX_AGE_HOURS of hourNow)
 * 
 * Returns the total strategy value in base token decimals, along with freshness metadata.
 * If no fresh snapshot is found, strategyValueBase will be null.
 */
async function getLatestStrategyValueForVault(
  ctx: ProcessorContext,
  vault: PortVault,
  hourNow: number
): Promise<{
  strategyValueBase: bigint | null;
  snapshotTs: number | null;
  snapshotFresh: boolean;
  snapshotsFound: number;
  uniqueStrategies: number;
}> {
  const strategySnapshots = await ctx.store.find(StrategyPositionSnapshot, {
    where: { vault: { id: vault.id } }
  })
  
  // Filter snapshots to only those at or before hourNow (no lookahead)
  const eligibleSnapshots = strategySnapshots.filter(snap => snap.blockTimestampSec <= hourNow)
  
  // Sort by blockTimestampSec descending and group by strategyAddr to get latest per strategy
  const sortedSnapshots = eligibleSnapshots.sort((a, b) => b.blockTimestampSec - a.blockTimestampSec)
  const latestByStrategy = new Map<string, StrategyPositionSnapshot>()
  for (const snap of sortedSnapshots) {
    const existing = latestByStrategy.get(snap.strategyAddr)
    if (!existing || snap.blockTimestampSec > existing.blockTimestampSec) {
      latestByStrategy.set(snap.strategyAddr, snap)
    }
  }
  
  // Check freshness: snapshot must be within MAX_AGE_HOURS of hourNow
  const maxAgeSec = STRATEGY_SNAPSHOT_MAX_AGE_HOURS * 3600
  let latestSnapshotTs: number | null = null
  let snapshotFresh = false
  
  // Find the latest snapshot timestamp across all strategies
  for (const snap of latestByStrategy.values()) {
    if (latestSnapshotTs === null || snap.blockTimestampSec > latestSnapshotTs) {
      latestSnapshotTs = snap.blockTimestampSec
    }
  }
  
  // Check if the latest snapshot is fresh
  if (latestSnapshotTs !== null) {
    const ageSec = hourNow - latestSnapshotTs
    snapshotFresh = ageSec <= maxAgeSec
  }
  
  // Sum all strategy values only if snapshot is fresh
  let strategyValueBase: bigint | null = null
  if (snapshotFresh) {
    strategyValueBase = 0n
    for (const snap of latestByStrategy.values()) {
      strategyValueBase += snap.valueBaseRaw
    }
  }
  
  return {
    strategyValueBase,
    snapshotTs: latestSnapshotTs,
    snapshotFresh,
    snapshotsFound: strategySnapshots.length,
    uniqueStrategies: latestByStrategy.size
  }
}

export const strategyService = {
  refreshStrategySnapshotsDaily,
  getLatestStrategyValueForVault,
  readClearpoolPositionValue,
  readCompoundPositionValue,
  readAavePositionValue,
}
