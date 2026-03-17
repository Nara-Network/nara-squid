/**
 * Simplified Expected Exchange Rate (EER) Module
 * 
 * This module implements a simplified EER calculation for vaults with NO funds diversion.
 * EER evolves smoothly over time using time-weighted fee accrual.
 * 
 * EER(hour) = expectedNetAssets(hour) / totalSharesTracked(hour)
 * 
 * Shares ONLY change on:
 * - Enter (mint shares)
 * - AtomicRequestFulfilled (burn shares)
 * 
 * Borrower actions (Drawdown/Topup) MUST NOT change shares or trigger recompute.
 * They only change utilization over time and therefore fee accrual speed.
 */

import { ProcessorContext, Log } from '../common/processor';
import { Config } from '../common/types';
import { BorrowedAssetBalance, ExpectedExchangeRate, ExpectedExchangeRateSnapshot, PortRequestFulfilled, PortVault } from '../model';
import { getEERConfigForVault } from '../helpers/eer';
import { clampToZero, getTokenDecimalsCached, normalizeDecimals, readContract } from '../helpers/common';
import { floorToHour, floorToMonthUTC, nextMonthStartUTC, secondsInMonthUTC, toSec } from '../common/utils/time';
import { portService } from './port';
import { throwError } from '../common/utils/error';


import * as ERC20Abi from '../abi/ERC20';
import * as BoringVaultAbi from '../abi/BoringVault';
import * as AtomicQueueAbi from '../abi/AtomicQueue';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';

import { In, LessThanOrEqual } from 'typeorm';
import { strategyService } from './strategy';

// Constants
const SECONDS_PER_YEAR = 31_536_000n;
const WAD = 10n ** 18n;
const BPS_DENOMINATOR = 10_000n;
const EER_UPDATE_TIME_WINDOW_MINUTES = 60; // Time window in minutes for EER updates
const LAST_UPDATE_TS_BY_NETWORK = new Map<string, number>()

// ============================================================================
// DEBUG LOGGING INFRASTRUCTURE
// ============================================================================
// Debug logging is now config-driven via eerDebug flag in expectedExchangeRateConfig.
// Use eerLogWithConfig for config-aware debug logging.
// ============================================================================

import { isEERDebugEnabled } from '../helpers/eer';

// Module-level cache for debug-enabled vaults (populated from config during updates)
let debugEnabledVaults = new Set<string>();

function setDebugEnabledVaults(config: Config): void {
  debugEnabledVaults = new Set<string>();
  if (config.Port?.Vaults) {
    for (const vault of config.Port.Vaults) {
      if (vault.expectedExchangeRateConfig?.eerDebug === true) {
        debugEnabledVaults.add(vault.address.toLowerCase());
      }
    }
  }
}

function isVaultDebugEnabled(vaultAddr: string): boolean {
  return debugEnabledVaults.has(vaultAddr.toLowerCase());
}

function eerLog(ctx: ProcessorContext, vaultAddr: string, msg: string): void {
  if (!isVaultDebugEnabled(vaultAddr)) return;
  ctx.log.info(msg);
}

function fmtBig(n: bigint): string {
  return n.toString();
}

function j(x: any): string {
  return JSON.stringify(x);
}

/**
 * Log detailed EER breakdown for debugging.
 * Prints: principal, accruedInterest, accruedCommitFee, borrowedBase, idle, invested, netAssets, shares, exchangeRate
 */
function logEERBreakdown(
  ctx: ProcessorContext,
  vaultAddr: string,
  data: {
    principal: bigint;
    accruedInterest: bigint;
    accruedCommitFee: bigint;
    borrowedBase: bigint;
    idle: bigint;
    invested: bigint;
    netAssets: bigint;
    shares: bigint;
    exchangeRate: bigint;
  }
): void {
  if (!isVaultDebugEnabled(vaultAddr)) return;
  ctx.log.info(
    `[EER DEBUG BREAKDOWN] vault=${vaultAddr} ` +
    `principal=${fmtBig(data.principal)} accruedInterest=${fmtBig(data.accruedInterest)} accruedCommitFee=${fmtBig(data.accruedCommitFee)} ` +
    `borrowedBase=${fmtBig(data.borrowedBase)} ` +
    `idle=${fmtBig(data.idle)} invested=${fmtBig(data.invested)} netAssets=${fmtBig(data.netAssets)} ` +
    `shares=${fmtBig(data.shares)} exchangeRate=${fmtBig(data.exchangeRate)}`
  );
}

// ============================================================================
// RAW EVENT INBOX SYSTEM (parserEerState)
// ============================================================================
// Parsers append raw events here; time window recompute drains and processes them.
// ============================================================================

/**
 * Domain-level classification of borrower transfers (from parser).
 * Parser determines this based on addresses; eerService maps to EER events.
 */
export type BorrowerTransferDomainKind = 'MANAGER_WITHDRAW' | 'MANAGER_DEPOSIT';

/**
 * Raw EER event types stored in inbox
 * 
 * IMPORTANT: All events include blockHeight for EVM-canonical ordering:
 * Events are sorted by (ts, blockHeight, logIndex, txHash) to ensure
 * deterministic processing order matching on-chain execution order.
 */
type EEREvent =
  | {
      kind: 'ENTER';
      ts: number;
      blockHeight: number; // Block number for EVM-canonical ordering
      vaultId: string;
      sharesDelta: bigint;
      assetsDeltaBase: bigint;
      txHash?: string;
      logIndex?: number;
    }
  | {
      kind: 'EXIT';
      ts: number;
      blockHeight: number; // Block number for EVM-canonical ordering
      vaultId: string;
      sharesDelta: bigint;
      assetsDeltaBase: bigint;
      txHash?: string;
      logIndex?: number;
    }
  | {
      kind: 'DRAWDOWN';
      ts: number;
      blockHeight: number; // Block number for EVM-canonical ordering
      vaultId: string;
      amountBase: bigint;
      token: string; // Token address (lowercase)
      amountRaw: bigint; // Raw amount before normalization
      tokenDecimals: number;
      txHash?: string;
      logIndex?: number;
    }
  | {
      kind: 'TOPUP';
      ts: number;
      blockHeight: number; // Block number for EVM-canonical ordering
      vaultId: string;
      amountBase: bigint;
      txHash?: string;
      logIndex?: number;
    }
  | {
      kind: 'FUNDS_DIVERTED';
      ts: number;
      blockHeight: number; // Block number for EVM-canonical ordering
      vaultId: string;
      amountBase: bigint;
      strategy: string; // Strategy address (lowercase) or strategy name like 'AAVE', 'COMPOUND', etc.
      token?: string; // Token address (lowercase), optional
      amountRaw?: bigint; // Raw amount before normalization, optional
      tokenDecimals?: number; // Optional
      txHash?: string;
      logIndex?: number;
    }
  | {
      kind: 'FUNDS_REVERTED';
      ts: number;
      blockHeight: number; // Block number for EVM-canonical ordering
      vaultId: string;
      amountBase: bigint;
      strategy: string; // Strategy address (lowercase) or strategy name like 'AAVE', 'COMPOUND', etc.
      token?: string; // Token address (lowercase), optional
      amountRaw?: bigint; // Raw amount before normalization, optional
      tokenDecimals?: number; // Optional
      txHash?: string;
      logIndex?: number;
    };

/**
 * Module-level inbox: Map<vaultId, { events: EEREvent[] }>
 */
const parserEerState = new Map<string, { events: EEREvent[] }>();

/**
 * Get or create inbox for a vault
 */
function getOrCreateInbox(vaultId: string): { events: EEREvent[] } {
  let inbox = parserEerState.get(vaultId);
  if (!inbox) {
    inbox = { events: [] };
    parserEerState.set(vaultId, inbox);
  }
  return inbox;
}

// ============================================================================
// RECORD METHODS (called by parsers - ONLY mutate inbox)
// ============================================================================

/**
 * Record an Enter event from parser.
 * Decodes log, normalizes to base decimals, appends to inbox.
 */
export async function recordEnterEvent(
  ctx: ProcessorContext,
  portVault: PortVault,
  log: Log
): Promise<void> {
  const { asset, amount, shares } = BoringVaultAbi.events.Enter.decode(log);
  
  const ts = toSec(log.block.timestamp);
  const assetLower = asset.toLowerCase();
  const baseTokenLower = portVault.baseToken.address.toLowerCase();
  const baseDec = Number(portVault.baseToken.decimals);
  
  // Normalize amount to base decimals
  let assetsDeltaBase = 0n;
  if (assetLower === baseTokenLower) {
    assetsDeltaBase = BigInt(amount);
  } else {
    // Convert non-base deposits to base decimals
    const tokenDec = await getTokenDecimalsCached(ctx, assetLower);
    assetsDeltaBase = normalizeDecimals(BigInt(amount), tokenDec, baseDec);
  }
  
  const sharesDelta = BigInt(shares);
  
  const inbox = getOrCreateInbox(portVault.id);
  const sizeBefore = inbox.events.length;
  const event: EEREvent = {
    kind: 'ENTER',
    ts,
    blockHeight: log.block.height,
    vaultId: portVault.id,
    sharesDelta,
    assetsDeltaBase,
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  };
  inbox.events.push(event);
  const sizeAfter = inbox.events.length;
  
  ctx.log.info(
    `[EER EVENT RECORDED] kind=ENTER vault=${portVault.address} ` +
    `sharesDelta=${sharesDelta.toString()} assetsDeltaBase=${assetsDeltaBase.toString()} ` +
    `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
  );
  
  eerLog(ctx, portVault.address,
    `[EER INBOX PUSH] vaultId=${portVault.id} kind=ENTER ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
    `sharesDelta=${fmtBig(sharesDelta)} assetsDeltaBase=${fmtBig(assetsDeltaBase)} ` +
    `sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
  );
}


/**
 * Record an AtomicRequestFulfilled event from parser.
 * Classifies as ENTER/EXIT/TOPUP internally and appends correct event(s).
 */
export async function recordAtomicRequestFulfilledEvent(
  ctx: ProcessorContext,
  portVault: PortVault,
  log: Log,
  config: Config
): Promise<void> {
  const {
    offerToken,
    wantToken,
    offerAmountSpent,
    wantAmountReceived,
  } = AtomicQueueAbi.events.AtomicRequestFulfilled.decode(log);
  
  const ts = toSec(log.block.timestamp);
  const offerTokenLower = offerToken.toLowerCase();
  const wantTokenLower = wantToken.toLowerCase();
  const vaultLower = portVault.address.toLowerCase();
  const baseTokenLower = portVault.baseToken.address.toLowerCase();
  
  const isWithdrawal = offerTokenLower === vaultLower;
  const isRepaymentSwap = offerTokenLower === baseTokenLower && wantTokenLower === vaultLower;
  
  const inbox = getOrCreateInbox(portVault.id);
  
  if (isWithdrawal) {
    // Withdrawal: shares burned, assets withdrawn
    const sharesBurned = BigInt(offerAmountSpent);
    let assetsOutBaseRaw = 0n;
    
    // Only track asset delta if withdrawal is in base token
    if (wantTokenLower === baseTokenLower) {
      assetsOutBaseRaw = BigInt(wantAmountReceived);
    }
    
    const sizeBefore = inbox.events.length;
    const event: EEREvent = {
      kind: 'EXIT',
      ts,
      blockHeight: log.block.height,
      vaultId: portVault.id,
      sharesDelta: -sharesBurned,
      assetsDeltaBase: -assetsOutBaseRaw,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
    };
    inbox.events.push(event);
    const sizeAfter = inbox.events.length;
    
    ctx.log.info(
      `[EER EVENT RECORDED] kind=EXIT vault=${portVault.address} ` +
      `sharesDelta=${event.sharesDelta.toString()} assetsDeltaBase=${event.assetsDeltaBase.toString()} ` +
      `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
    );
    
    eerLog(ctx, portVault.address,
      `[EER INBOX PUSH] vaultId=${portVault.id} kind=EXIT ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `sharesDelta=${fmtBig(event.sharesDelta)} assetsDeltaBase=${fmtBig(event.assetsDeltaBase)} ` +
      `sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
    );
  } else if (isRepaymentSwap) {
    // Repayment swap: base -> shares (treated as topup for EER purposes)
    const baseDec = Number(portVault.baseToken.decimals);
    const offerTokenDec = await getTokenDecimalsCached(ctx, offerTokenLower);
    const amountBaseRaw = normalizeDecimals(BigInt(offerAmountSpent), offerTokenDec, baseDec);
    
    const sizeBefore = inbox.events.length;
    const event: EEREvent = {
      kind: 'TOPUP',
      ts,
      blockHeight: log.block.height,
      vaultId: portVault.id,
      amountBase: amountBaseRaw,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
    };
    inbox.events.push(event);
    const sizeAfter = inbox.events.length;
    
    ctx.log.info(
      `[EER EVENT RECORDED] kind=TOPUP vault=${portVault.address} ` +
      `amountBase=${amountBaseRaw.toString()} ` +
      `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
    );
    
    eerLog(ctx, portVault.address,
      `[EER INBOX PUSH] vaultId=${portVault.id} kind=TOPUP ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `amountBase=${fmtBig(amountBaseRaw)} sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
    );
  }
  // Other flows (e.g., non-vault swaps) are ignored
}

/**
 * Record a Borrower Transfer event from parser (drawdown or topup).
 * 
 * Direction is determined by parser (domainKind); this function only:
 * - Validates token (withdraw: must be vault asset, deposit: must be base token)
 * - Normalizes amounts to base decimals
 * - Maps domain kind to EER event kind
 * - Appends to inbox
 */
export async function recordBorrowerTransferEvent(
  ctx: ProcessorContext,
  portVault: PortVault,
  log: Log,
  config: Config,
  domainKind: BorrowerTransferDomainKind
): Promise<void> {
  const { value } = ERC20Abi.events.Transfer.decode(log);
  const token = log.address.toLowerCase();
  const baseTokenLower = portVault.baseToken.address.toLowerCase();
  
  const ts = toSec(log.block.timestamp);
  const inbox = getOrCreateInbox(portVault.id);
  
  if (domainKind === 'MANAGER_WITHDRAW') {
    // DRAWDOWN: token must be a vault asset
    const vaultAssetsLower = portVault.assets.map(a => a.toLowerCase());
    if (!vaultAssetsLower.includes(token)) {
      ctx.log.warn(
        `[EER EVENT SKIP] MANAGER_WITHDRAW token ${token} not in vault ${portVault.address} assets`
      );
      return;
    }
    
    const tokenDec = await getTokenDecimalsCached(ctx, token);
    const baseDec = Number(portVault.baseToken.decimals);
    const amountBaseRaw = normalizeDecimals(BigInt(value), tokenDec, baseDec);
    
    const sizeBefore = inbox.events.length;
    const event: EEREvent = {
      kind: 'DRAWDOWN',
      ts,
      blockHeight: log.block.height,
      vaultId: portVault.id,
      amountBase: amountBaseRaw,
      token: token,
      amountRaw: BigInt(value),
      tokenDecimals: tokenDec,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
    };
    inbox.events.push(event);
    const sizeAfter = inbox.events.length;
    
    ctx.log.info(
      `[EER EVENT RECORDED] kind=DRAWDOWN vault=${portVault.address} ` +
      `token=${token} amountRaw=${value.toString()} amountBase=${amountBaseRaw.toString()} ` +
      `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
    );
    
    eerLog(ctx, portVault.address,
      `[EER INBOX PUSH] vaultId=${portVault.id} kind=DRAWDOWN ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `token=${token} amountRaw=${fmtBig(BigInt(value))} amountBase=${fmtBig(amountBaseRaw)} tokenDecimals=${tokenDec} ` +
      `sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
    );
    return;
  }
  
  if (domainKind === 'MANAGER_DEPOSIT') {
    // TOPUP: token must be base token
    if (token !== baseTokenLower) {
      ctx.log.warn(
        `[EER EVENT SKIP] MANAGER_DEPOSIT token ${token} is not base token ${baseTokenLower}`
      );
      return;
    }
    
    const tokenDec = await getTokenDecimalsCached(ctx, token);
    const baseDec = Number(portVault.baseToken.decimals);
    const amountBaseRaw = normalizeDecimals(BigInt(value), tokenDec, baseDec);
    
    const sizeBefore = inbox.events.length;
    const event: EEREvent = {
      kind: 'TOPUP',
      ts,
      blockHeight: log.block.height,
      vaultId: portVault.id,
      amountBase: amountBaseRaw,
      txHash: log.transactionHash,
      logIndex: log.logIndex,
    };
    inbox.events.push(event);
    const sizeAfter = inbox.events.length;
    
    ctx.log.info(
      `[EER EVENT RECORDED] kind=TOPUP vault=${portVault.address} ` +
      `amountBase=${amountBaseRaw.toString()} ` +
      `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
    );
    
    eerLog(ctx, portVault.address,
      `[EER INBOX PUSH] vaultId=${portVault.id} kind=TOPUP ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `amountBase=${fmtBig(amountBaseRaw)} sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
    );
    return;
  }
  
  // Unknown domain kind - should not happen
  ctx.log.error(
    `[EER EVENT ERROR] Unknown domainKind=${domainKind} for vault=${portVault.address} txHash=${log.transactionHash}`
  );
}

/**
 * Record a Funds Diverted event (strategy deposit: idle → invested).
 * 
 * This is called by parsers when they detect strategy deposits (Aave Supply, Compound Supply, etc.).
 * The event is appended to the inbox and will be processed during the next EER recompute.
 */
export async function recordFundsDivertedEvent(
  ctx: ProcessorContext,
  portVault: PortVault,
  amountBase: bigint,
  strategy: string,
  log: Log,
  token?: string,
  amountRaw?: bigint,
  tokenDecimals?: number
): Promise<void> {
  const ts = toSec(log.block.timestamp);
  const inbox = getOrCreateInbox(portVault.id);
  const sizeBefore = inbox.events.length;
  
  const event: EEREvent = {
    kind: 'FUNDS_DIVERTED',
    ts,
    blockHeight: log.block.height,
    vaultId: portVault.id,
    amountBase,
    strategy: strategy.toLowerCase(),
    token: token?.toLowerCase(),
    amountRaw,
    tokenDecimals,
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  };
  
  inbox.events.push(event);
  const sizeAfter = inbox.events.length;
  
  ctx.log.info(
    `[EER EVENT RECORDED] kind=FUNDS_DIVERTED vault=${portVault.address} ` +
    `amountBase=${amountBase.toString()} strategy=${strategy.toLowerCase()} ` +
    `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
  );
  
  eerLog(ctx, portVault.address,
    `[EER INBOX PUSH] vaultId=${portVault.id} kind=FUNDS_DIVERTED ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
    `amountBase=${fmtBig(amountBase)} strategy=${strategy.toLowerCase()} ` +
    `sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
  );
}

/**
 * Record a Funds Reverted event (strategy withdraw: invested → idle).
 * 
 * This is called by parsers when they detect strategy withdrawals (Aave Withdraw, Compound Withdraw, etc.).
 * The event is appended to the inbox and will be processed during the next EER recompute.
 */
export async function recordFundsRevertedEvent(
  ctx: ProcessorContext,
  portVault: PortVault,
  amountBase: bigint,
  strategy: string,
  log: Log,
  token?: string,
  amountRaw?: bigint,
  tokenDecimals?: number
): Promise<void> {
  const ts = toSec(log.block.timestamp);
  const inbox = getOrCreateInbox(portVault.id);
  const sizeBefore = inbox.events.length;
  
  const event: EEREvent = {
    kind: 'FUNDS_REVERTED',
    ts,
    blockHeight: log.block.height,
    vaultId: portVault.id,
    amountBase,
    strategy: strategy.toLowerCase(),
    token: token?.toLowerCase(),
    amountRaw,
    tokenDecimals,
    txHash: log.transactionHash,
    logIndex: log.logIndex,
  };
  
  inbox.events.push(event);
  const sizeAfter = inbox.events.length;
  
  ctx.log.info(
    `[EER EVENT RECORDED] kind=FUNDS_REVERTED vault=${portVault.address} ` +
    `amountBase=${amountBase.toString()} strategy=${strategy.toLowerCase()} ` +
    `ts=${ts} block=${log.block.height} txHash=${log.transactionHash} logIndex=${log.logIndex}`
  );
  
  eerLog(ctx, portVault.address,
    `[EER INBOX PUSH] vaultId=${portVault.id} kind=FUNDS_REVERTED ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
    `amountBase=${fmtBig(amountBase)} strategy=${strategy.toLowerCase()} ` +
    `sizeBefore=${sizeBefore} sizeAfter=${sizeAfter}`
  );
}

/**
 * Vault state tracked for simplified EER calculation
 */
export interface VaultState {
  totalSharesTracked: bigint;
  idleBaseTracked: bigint;
  investedBaseTracked: bigint; // Funds deployed to strategies (Aave, Compound, etc.)
  borrowedPrincipalBaseTracked: bigint;
  // Lifetime totals (if already exist, keep them)
  accruedCommitmentFeeBase: bigint; // commitFeeAccruedTotalBase
  accruedBorrowInterestBase: bigint; // borrowInterestAccruedTotalBase
  lastAccrualTs: number;
  // Month-to-date tracking
  commitFeeAccruedMtdBase: bigint;
  borrowInterestAccruedMtdBase: bigint;
  mtdMonthStartTs: number; // UTC seconds aligned to month start
  // Per-update diagnostics (optional)
  commitFeeAccruedThisHour: bigint;
  borrowInterestAccruedThisHour: bigint;
}

/**
 * Fee rates for accrual calculations
 */
interface FeeRates {
  commitFeeRateBps: bigint;
  borrowRateBps: bigint;
}

/**
 * Ensure vault state is initialized on the EER entity.
 * Loads or initializes tracked state fields.
 */
export async function ensureVaultState(
  vaultId: string,
  ctx: ProcessorContext,
  expectedExchangeRates: Map<string, ExpectedExchangeRate>,
  blockTimestamp: number
): Promise<VaultState> {
  let eer = expectedExchangeRates.get(vaultId);
  if (!eer) {
    eer = await ctx.store.get(ExpectedExchangeRate, vaultId);
    if (!eer) {
      throw new Error(`ExpectedExchangeRate not found for vaultId=${vaultId}`);
    }
    expectedExchangeRates.set(eer.id, eer);
  }

  // Initialize tracked state from existing persisted values or safe defaults
  const nowSec = toSec(blockTimestamp);
  const monthStartTs = floorToMonthUTC(nowSec);

  // Compute borrowedBase from components for fallback (Option A: idle = netAssets - invested - borrowedBase)
  const borrowedBaseForFallback = computeBorrowedBase(
    eer.expectedBorrowedPrincipalBaseRaw ?? 0n,
    eer.accruedBorrowInterestBase ?? 0n,
    eer.accruedCommitmentFeeBase ?? 0n
  );
  const idleFallback = (eer.netAssetsTrackedBaseRaw ?? 0n) - (eer.investedBaseTracked ?? 0n) - borrowedBaseForFallback;

  return {
    totalSharesTracked: eer.totalSharesTracked ?? 0n,
    idleBaseTracked: eer.idleBaseTracked ?? (idleFallback < 0n ? 0n : idleFallback),
    investedBaseTracked: eer.investedBaseTracked ?? 0n,
    borrowedPrincipalBaseTracked: eer.expectedBorrowedPrincipalBaseRaw ?? 0n,
    accruedCommitmentFeeBase: eer.accruedCommitmentFeeBase ?? 0n,
    accruedBorrowInterestBase: eer.accruedBorrowInterestBase ?? 0n,
    lastAccrualTs: eer.expectedLastAccrualTs ?? nowSec,
    // MTD tracking
    commitFeeAccruedMtdBase: eer.commitmentFeeAccruedMtdBaseRaw ?? 0n,
    borrowInterestAccruedMtdBase: eer.borrowInterestAccruedMtdBaseRaw ?? 0n,
    mtdMonthStartTs: eer.commitmentFeeMtdMonthStartTs ?? monthStartTs,
    // Per-update counters
    commitFeeAccruedThisHour: 0n,
    borrowInterestAccruedThisHour: 0n,
  };
}

/**
 * Accrue fees using time-weighted utilization history.
 * 
 * Commitment fee accrues on idle (unutilized) capital.
 * Borrow interest accrues on borrowed principal.
 * 
 * Both are receivables (paid by borrower to vault), so they increase assets.
 * 
 * NOTE: This function uses investedBaseTracked (principal only). For accurate commitment fee accrual,
 * it should use effectiveStrategyValueBase (current diverted value = principal + returns) instead.
 * The main update flow uses accrueFeesBetween() which correctly uses effectiveStrategyValueBase.
 */
export function accrueFees(
  vaultState: VaultState,
  fromTs: number,
  toTs: number,
  rates: FeeRates,
  ctx: ProcessorContext,
  vaultAddress: string
): void {
  const dtSec = Math.max(0, toTs - fromTs);

  if (dtSec < 0) {
    ctx.log.error(
      `[EER INVARIANT VIOLATION] dtSec < 0: vault=${vaultAddress} fromTs=${fromTs} toTs=${toTs} dtSec=${dtSec}`
    );
    return;
  }

  if (dtSec === 0) {
    return; // No time elapsed, no accrual
  }

  // Accrue commitment fee on unutilized capital (idle + invested)
  // NOTE: Should use effectiveStrategyValueBase (current diverted value) instead of investedBaseTracked (principal only)
  const unutilisedBase = vaultState.idleBaseTracked + vaultState.investedBaseTracked;
  const commitFee = (unutilisedBase * rates.commitFeeRateBps * BigInt(dtSec)) /
    (BPS_DENOMINATOR * SECONDS_PER_YEAR);

  // Accrue borrow interest on borrowed principal
  const borrowInterest = (vaultState.borrowedPrincipalBaseTracked * rates.borrowRateBps * BigInt(dtSec)) /
    (BPS_DENOMINATOR * SECONDS_PER_YEAR);

  // Update cumulative accruals
  vaultState.accruedCommitmentFeeBase += commitFee;
  vaultState.accruedBorrowInterestBase += borrowInterest;

  // Update per-update counters
  vaultState.commitFeeAccruedThisHour += commitFee;
  vaultState.borrowInterestAccruedThisHour += borrowInterest;

  // Update last accrual timestamp
  vaultState.lastAccrualTs = toTs;

  ctx.log.info(
    `[EER ACCRUE] vault=${vaultAddress} from=${fromTs} to=${toTs} dt=${dtSec} ` +
    `idle=${vaultState.idleBaseTracked.toString()} borrowed=${vaultState.borrowedPrincipalBaseTracked.toString()} ` +
    `commitFee=${commitFee.toString()} borrowInt=${borrowInterest.toString()}`
  );
}

/**
 * Apply Enter event (mint shares, deposit assets).
 * 
 * Before applying: accrue fees from lastAccrualTs to eventTs.
 */
export function applyEnter(
  vaultState: VaultState,
  assetsIn: bigint,
  sharesMinted: bigint,
  eventTs: number,
  rates: FeeRates,
  ctx: ProcessorContext,
  vaultAddress: string
): void {
  // Accrue fees up to event timestamp
  accrueFees(vaultState, vaultState.lastAccrualTs, eventTs, rates, ctx, vaultAddress);

  // Apply Enter deltas
  vaultState.totalSharesTracked += sharesMinted;
  vaultState.idleBaseTracked += assetsIn;

  ctx.log.info(
    `[EER ENTER] assets=${assetsIn.toString()} shares=${sharesMinted.toString()} ` +
    `newIdle=${vaultState.idleBaseTracked.toString()} newShares=${vaultState.totalSharesTracked.toString()}`
  );
}

/**
 * Apply AtomicRequestFulfilled event (burn shares, withdraw assets).
 * 
 * Before applying: accrue fees from lastAccrualTs to eventTs.
 */
export function applyAtomicRequestFulfilled(
  vaultState: VaultState,
  sharesBurned: bigint,
  assetsOut: bigint,
  eventTs: number,
  rates: FeeRates,
  ctx: ProcessorContext,
  vaultAddress: string
): void {
  // Accrue fees up to event timestamp
  accrueFees(vaultState, vaultState.lastAccrualTs, eventTs, rates, ctx, vaultAddress);

  // Apply exit deltas (with clamping)
  vaultState.totalSharesTracked = vaultState.totalSharesTracked > sharesBurned
    ? vaultState.totalSharesTracked - sharesBurned
    : 0n;

  if (vaultState.idleBaseTracked >= assetsOut) {
    vaultState.idleBaseTracked -= assetsOut;
  } else {
    ctx.log.warn(
      `[EER INVARIANT VIOLATION] idleBaseTracked would go negative: ` +
      `vault=${vaultAddress} idleBefore=${vaultState.idleBaseTracked.toString()} ` +
      `assetsOut=${assetsOut.toString()} CLAMPING TO 0`
    );
    vaultState.idleBaseTracked = 0n;
  }

  ctx.log.info(
    `[EER EXIT] assetsOut=${assetsOut.toString()} sharesBurned=${sharesBurned.toString()} ` +
    `newIdle=${vaultState.idleBaseTracked.toString()} newShares=${vaultState.totalSharesTracked.toString()}`
  );
}

/**
 * Apply Borrower Drawdown (increase borrowed principal, decrease idle).
 * 
 * Before applying: accrue fees from lastAccrualTs to eventTs.
 */
export function applyBorrowerDrawdown(
  vaultState: VaultState,
  amount: bigint,
  eventTs: number,
  rates: FeeRates,
  ctx: ProcessorContext,
  vaultAddress: string
): void {
  // Accrue fees up to event timestamp
  accrueFees(vaultState, vaultState.lastAccrualTs, eventTs, rates, ctx, vaultAddress);

  // Apply drawdown deltas (with clamping)
  const idleBefore = vaultState.idleBaseTracked;
  if (vaultState.idleBaseTracked >= amount) {
    vaultState.idleBaseTracked -= amount;
  } else {
    ctx.log.warn(
      `[EER INVARIANT VIOLATION] idleBaseTracked would go negative on drawdown: ` +
      `vault=${vaultAddress} idleBefore=${idleBefore.toString()} ` +
      `amount=${amount.toString()} CLAMPING TO 0`
    );
    vaultState.idleBaseTracked = 0n;
  }

  vaultState.borrowedPrincipalBaseTracked += amount;

  ctx.log.info(
    `[EER DRAWDOWN] amount=${amount.toString()} idleBefore=${idleBefore.toString()} ` +
    `idleAfter=${vaultState.idleBaseTracked.toString()} borrowedAfter=${vaultState.borrowedPrincipalBaseTracked.toString()}`
  );
}



/**
 * Get fee rates for a vault from config.
 * Returns commitment fee rate (based on utilization tier) and borrow rate.
 */
export function getFeeRates(
  config: Config,
  vault: PortVault,
  vaultState: VaultState
): FeeRates {
  const eerCfg = getEERConfigForVault(config, vault.address);
  if (!eerCfg) {
    throw new Error(`EER config not found for vault=${vault.address}`);
  }

  const borrowRateBps = BigInt(eerCfg.borrowRateBps);

  // Calculate utilization to determine commitment fee tier
  const totalCapital = vaultState.idleBaseTracked + vaultState.borrowedPrincipalBaseTracked;
  let utilBps = 0n;
  if (totalCapital > 0n) {
    utilBps = (vaultState.borrowedPrincipalBaseTracked * BPS_DENOMINATOR) / totalCapital;
  }

  // Commitment fee tier based on utilization - HARD-CODED (no config)
  // Use hard-coded getCommitmentFeeRateBps function (defined in updateExpectedExchangeRateForVaults)
  // This function is deprecated - use getRatesForState() instead which uses hard-coded tiers
  const commitFeeRateBps = 600n; // Placeholder - this function should not be used

  return {
    commitFeeRateBps,
    borrowRateBps,
  };
}

/**
 * Compute borrowed base (total borrower liability).
 * 
 * borrowedBase = borrowedPrincipalBase + accruedBorrowInterestBase + accruedCommitmentFeeBase
 * 
 * All three components are owed by the borrower until repaid.
 */
export function computeBorrowedBase(
  borrowedPrincipalBase: bigint,
  accruedBorrowInterestBase: bigint,
  accruedCommitmentFeeBase: bigint
): bigint {
  return borrowedPrincipalBase + accruedBorrowInterestBase + accruedCommitmentFeeBase;
}

/**
 * Compute net assets from components (Option A invariant).
 * 
 * netAssetsBase = idleBase + divertedValueBase + borrowedBase
 * 
 * where borrowedBase = principal + accruedInterest + accruedCommitmentFee.
 * This avoids double counting by including commitment fee only once (inside borrowedBase).
 * 
 * WARNING: The `investedBase` parameter should represent the CURRENT diverted value
 * (principal + strategy returns), NOT just principal. If you have `effectiveStrategyValueBase`,
 * use that instead of `investedBaseTracked` to avoid double-counting commitment fees.
 */
export function computeNetAssetsBase(
  idleBase: bigint,
  investedBase: bigint, // Should be current diverted value (principal + returns), not just principal
  borrowedBase: bigint
): bigint {
  return idleBase + investedBase + borrowedBase;
}

/**
 * Compute expected net assets from vault state.
 * 
 * Uses Option A invariant: netAssets = idle + divertedValueBase + borrowedBase
 * where borrowedBase = principal + accruedInterest + accruedCommitmentFee.
 * 
 * Note: Both borrow interest and commitment fees are receivables (paid by borrower to vault).
 * They increase assets, not decrease them.
 * Invested funds are still part of assets, just deployed to strategies.
 * 
 * WARNING: This function uses `vaultState.investedBaseTracked` which is principal only.
 * For accurate NAV calculation, you should use `effectiveStrategyValueBase` (current diverted value)
 * instead. This function is part of the legacy API and may not be used in the main update flow.
 */
export function computeExpectedNetAssets(vaultState: VaultState): bigint {
  const borrowedBase = computeBorrowedBase(
    vaultState.borrowedPrincipalBaseTracked,
    vaultState.accruedBorrowInterestBase,
    vaultState.accruedCommitmentFeeBase
  );
  return computeNetAssetsBase(
    vaultState.idleBaseTracked,
    vaultState.investedBaseTracked, // WARNING: This is principal only - should use effectiveStrategyValueBase if available
    borrowedBase
  );
}

/**
 * Compute expected exchange rate from vault state.
 * 
 * EER = expectedNetAssets * shareDecFactor / totalSharesTracked
 */
export function computeExpectedExchangeRate(
  vaultState: VaultState,
  shareDecFactor: bigint
): bigint {
  if (vaultState.totalSharesTracked === 0n) {
    return shareDecFactor; // Default to 1.0 in base decimals
  }

  const expectedNetAssets = computeExpectedNetAssets(vaultState);
  return (expectedNetAssets * shareDecFactor) / vaultState.totalSharesTracked;
}

/**
 * Persist vault state back to EER entity.
 */
export function persistVaultState(
  vaultState: VaultState,
  eer: ExpectedExchangeRate,
  updateTs: number,
  shareDecFactor: bigint
): void {
  eer.totalSharesTracked = vaultState.totalSharesTracked;
  eer.idleBaseTracked = vaultState.idleBaseTracked;
  eer.investedBaseTracked = vaultState.investedBaseTracked;
  eer.expectedBorrowedPrincipalBaseRaw = vaultState.borrowedPrincipalBaseTracked;
  eer.accruedCommitmentFeeBase = vaultState.accruedCommitmentFeeBase;
  eer.accruedBorrowInterestBase = vaultState.accruedBorrowInterestBase;
  eer.expectedLastAccrualTs = vaultState.lastAccrualTs;
  eer.expectedLastUpdateTs = updateTs;

  // Compute borrowed base (includes commitment fee as borrower liability)
  const borrowedBase = computeBorrowedBase(
    vaultState.borrowedPrincipalBaseTracked,
    vaultState.accruedBorrowInterestBase,
    vaultState.accruedCommitmentFeeBase
  );
  eer.expectedBorrowedBaseRaw = borrowedBase;

  // Update expected exchange rate and net assets tracked
  const expectedNetAssets = computeExpectedNetAssets(vaultState);
  eer.expectedAssetsBaseRaw = expectedNetAssets;
  eer.netAssetsTrackedBaseRaw = expectedNetAssets; // Keep in sync
  eer.expectedExchangeRateBaseRaw = computeExpectedExchangeRate(vaultState, shareDecFactor);
}

export async function updateExpectedExchangeRateForVaults(
  ctx: ProcessorContext,
  portVaults: Map<string, PortVault>,
  expectedExchangeRates: Map<string, ExpectedExchangeRate>,
  snapshots: Map<string, ExpectedExchangeRateSnapshot>,
  config: Config,
  borrowedBalances: Map<string, BorrowedAssetBalance>,
  blockHeight: number,
  blockTimestamp: number
): Promise<{
  portVaults: Map<string, PortVault>
  expectedExchangeRates: Map<string, ExpectedExchangeRate>
  snapshots: Map<string, ExpectedExchangeRateSnapshot>
}> {
  // Circuit breaker: ensure we don't process blocks beyond 41015527
  const MAX_ALLOWED_BLOCK = 41015527000n
  if (BigInt(blockHeight) > MAX_ALLOWED_BLOCK) {
    const errorMsg = `[EER CIRCUIT BREAKER] blockHeight=${blockHeight} exceeds MAX_ALLOWED_BLOCK=${MAX_ALLOWED_BLOCK.toString()}. EER calculation stopped to ensure data integrity.`
    ctx.log.error(errorMsg)
    throw new Error(errorMsg)
  }

  // ============================================================================
  // EER UPDATES BASED ON TIME WINDOW (in minutes)
  // ============================================================================
  const network = ctx.syncedNetwork
  const nowSec = toSec(blockTimestamp)
  
  // CRITICAL: Deterministic cutoff calculation using floor-based time windows
  // This ensures consistent cutoff regardless of block timestamp variance
  // If window=60m: cutoffTs = floor(nowSec / 3600) * 3600
  // If window=1m: cutoffTs = floor(nowSec / 60) * 60
  // Generalize: cutoffTs = floor(nowSec / (windowMinutes * 60)) * (windowMinutes * 60)
  const timeWindowSeconds = EER_UPDATE_TIME_WINDOW_MINUTES * 60
  const cutoffTs = Math.floor(nowSec / timeWindowSeconds) * timeWindowSeconds
  
  const hourTs = floorToHour(cutoffTs) // Hour boundary for hourly gating/labels only
  
  // CRITICAL: Compute fixed window end to prevent double-accrual when running on every block
  // windowEndTs = cutoffTs (they are now the same with deterministic cutoff)
  const windowEndTs = cutoffTs

  const lastUpdateTs = LAST_UPDATE_TS_BY_NETWORK.get(network) ?? 0
  const shouldUpdate = (nowSec - lastUpdateTs) >= timeWindowSeconds

  if (!shouldUpdate) {
    return { portVaults, expectedExchangeRates, snapshots }
  }

  const configuredVaultAddrs = (config.Port?.Vaults ?? []).filter(v => v.expectedExchangeRateConfig !== undefined).map((v) => v.address.toLowerCase())
  if (configuredVaultAddrs.length === 0) {
    LAST_UPDATE_TS_BY_NETWORK.set(network, nowSec)
    return { portVaults, expectedExchangeRates, snapshots }
  }

  // Update global timestamp cursor for this network
  LAST_UPDATE_TS_BY_NETWORK.set(network, nowSec)

  // Initialize config-driven debug vault set
  setDebugEnabledVaults(config)

  // ============================================================================
  // Global Time Window Log
  // ============================================================================
  ctx.log.info(
    `[EER TIME WINDOW GATE] network=${network} block=${blockHeight} blockTimestamp=${blockTimestamp} nowSec=${nowSec} cutoffTs=${cutoffTs} windowEndTs=${windowEndTs} hourTs=${hourTs} ` +
    `lastUpdateTs=${lastUpdateTs} timeWindowMinutes=${EER_UPDATE_TIME_WINDOW_MINUTES} shouldUpdate=${shouldUpdate} targets=${configuredVaultAddrs.length}`
  );

  // ============================================================================
  // Prefetch missing vaults from DB (so we can iterate all configured vaults)
  // ============================================================================
  const missing = configuredVaultAddrs.filter((a) => !portVaults.has(a))
  if (missing.length) {
    const dbVaults = await ctx.store.find(PortVault, {
      where: { address: In(missing), network: ctx.syncedNetwork },
      relations: { baseToken: true },
    })
    for (const v of dbVaults) {
      portVaults.set(v.address.toLowerCase(), v)
    }
  }

  // ============================================================================
  // Local helpers (kept inside this function to keep everything “one place”)
  // ============================================================================
  type FeeRates = { commitFeeRateBps: bigint; borrowRateBps: bigint }

  function clamp0(x: bigint) {
    return x < 0n ? 0n : x
  }

  function computeLocalBorrowedBase(
    borrowedPrincipalBaseTracked: bigint,
    accruedBorrowInterestBase: bigint,
    accruedCommitmentFeeBase: bigint
  ) {
    // borrowedBase = principal + interest + commitmentFee (all owed by borrower)
    return borrowedPrincipalBaseTracked + accruedBorrowInterestBase + accruedCommitmentFeeBase
  }

  function computeNetAssets(
    idleBaseTracked: bigint,
    divertedValueBase: bigint, // Current diverted value (principal + returns), NOT just principal
    borrowedPrincipalBaseTracked: bigint,
    accruedBorrowInterestBase: bigint,
    accruedCommitmentFeeBase: bigint
  ) {
    // Option A invariant: netAssets = idle + divertedValueBase + borrowedBase
    // divertedValueBase is the current strategy value (principal + returns)
    // borrowedBase includes commitment fee, so no separate add needed
    // CRITICAL: Do NOT use investedBaseTracked here - it's principal only and would double-count
    // commitment fees that were already accrued on divertedValueBase
    const borrowedBase = computeLocalBorrowedBase(borrowedPrincipalBaseTracked, accruedBorrowInterestBase, accruedCommitmentFeeBase)
    return idleBaseTracked + divertedValueBase + borrowedBase
  }

  function computeExchangeRate(netAssetsBase: bigint, totalShares: bigint, shareDecFactor: bigint) {
    if (totalShares === 0n) return shareDecFactor // 1.0
    if (netAssetsBase <= 0n) return 0n
    return (netAssetsBase * shareDecFactor) / totalShares
  }

  /**
   * Hard-coded commitment fee tiers (as per Excel spec 1.2(b) – Commitment Fee on Unutilized Capital)
   * 
   * EXACT FORMULA with explicit boundaries:
   * [0%, 10%) → 6% (600 bps)      [0, 1000) bps
   * [10%, 50%) → 5% (500 bps)     [1000, 5000) bps
   * [50%, 90%) → 3.50% (350 bps)  [5000, 9000) bps
   * [90%, 100%] → 2.50% (250 bps) [9000, 10000] bps
   * 
   * Boundary rules:
   * - 1000 bps (10.00%) → 5% tier (lower bound inclusive)
   * - 5000 bps (50.00%) → 3.5% tier (lower bound inclusive)
   * - 9000 bps (90.00%) → 2.5% tier (lower bound inclusive)
   * 
   * CRITICAL: Utilization is based on borrowedForTier (principal + interest, NO commitment fee)
   * to avoid circular dependency. NO config overrides. NO fallbacks. Single source of truth.
   * 
   * TIER BOUNDARY SEMANTICS:
   * Uses strict > comparisons (not >=) to match Excel behavior:
   * - utilBps > 9000 → 250 bps (90%+)
   * - utilBps > 5000 → 350 bps (50-90%)
   * - utilBps > 1000 → 500 bps (10-50%)
   * - utilBps <= 1000 → 600 bps (0-10%)
   * 
   * NOTE: Verify this matches Excel exactly - Excel may use >= at boundaries instead of >.
   * If Excel uses ">= 50%" rather than "> 50%", update comparisons accordingly.
   */
  function getCommitmentFeeRateBps(utilizationBps: bigint): bigint {
    // [90%, 100%] → 2.50% (250 bps) - uses > 9000 (strict greater than)
    if (utilizationBps > 9000n) return 250n
    // [50%, 90%) → 3.50% (350 bps) - uses > 5000 (strict greater than)
    if (utilizationBps > 5000n) return 350n
    // [10%, 50%) → 5% (500 bps) - uses > 1000 (strict greater than)
    if (utilizationBps > 1000n) return 500n
    // [0%, 10%) → 6% (600 bps) - uses <= 1000 (inclusive lower bound)
    return 600n
  }

  /**
   * Get fee rates for a vault state.
   * 
   * CRITICAL: Uses borrowedForTier (principal + interest only) for tier selection to avoid
   * circular dependency where commitment fee affects utilization which affects tier selection.
   * 
   * @param borrowedForTier - Principal + accrued borrow interest (NO commitment fee)
   */
  function getRatesForState(vault: PortVault, idleBase: bigint, divertedValueBase: bigint, borrowedForTier: bigint): FeeRates {
    const eerCfg = getEERConfigForVault(config, vault.address)
    if (!eerCfg) throw new Error(`EER config not found for vault=${vault.address}`)

    const borrowRateBps = BigInt(eerCfg.borrowRateBps)

    // Calculate utilization for tier selection using borrowedForTier (principal + interest only)
    // This avoids circular dependency: commitment fee does NOT affect tier selection
    // divertedValueBase represents CURRENT diverted value (principal + returns), not just principal
    // Diverted funds are considered unutilized (idle) for commitment fee calculation
    // 
    // CRITICAL: Use floor division to prevent rounding up at boundaries (e.g., 49.999% → 4999 bps, not 5002 bps)
    // Bigint division already floors, but we ensure deterministic calculation:
    // utilForTierBps = floor(borrowedForTier * 10000 / totalForTier)
    const totalForTier = idleBase + divertedValueBase + borrowedForTier
    let utilForTierBps = 0n
    if (totalForTier > 0n) {
      // Bigint division already floors, ensuring deterministic boundary handling
      // Example: (1831732 * 10000) / 3663465 = 4999 (not 5002)
      utilForTierBps = (borrowedForTier * BPS_DENOMINATOR) / totalForTier
    }

    // Hard-coded commitment fee tiers (NO config dependency)
    // Tier selection based on utilForTierBps (NO commitment fee in denominator)
    const commitFeeRateBps = getCommitmentFeeRateBps(utilForTierBps)

    return { commitFeeRateBps, borrowRateBps }
  }

  function accrueFeesBetween(
    vaultAddress: string,
    fromTs: number,
    toTs: number,
    idleBaseTracked: bigint,
    divertedValueBase: bigint, // Changed from investedBaseTracked to divertedValueBase (current value, not just principal)
    borrowedBaseStart: bigint, // EXCEL BEHAVIOR: principal + accruedBorrowInterest + accruedCommitmentFee (interest-on-interest)
    rates: FeeRates,
    commitFeeRemainderIn: bigint,
    borrowInterestRemainderIn: bigint
  ): { commitFee: bigint; borrowInterest: bigint; dtSec: number; commitFeeRemainder: bigint; borrowInterestRemainder: bigint } {
    const dtSec = Math.max(0, toTs - fromTs)
    if (dtSec <= 0) return { commitFee: 0n, borrowInterest: 0n, dtSec: 0, commitFeeRemainder: commitFeeRemainderIn, borrowInterestRemainder: borrowInterestRemainderIn }

    const DENOM = BPS_DENOMINATOR * SECONDS_PER_YEAR

    // Commitment fee accrues on unutilized capital = idle + divertedValueBase (current diverted value, not just principal)
    // divertedValueBase represents the CURRENT strategy position value (principal + returns), not just principal
    // REMAINDER ACCUMULATION: carry forward truncated fraction from previous segments to prevent
    // BigInt truncation drift with small amounts / short time windows
    const unutilisedBase = idleBaseTracked + divertedValueBase
    const commitFeeNumerator = unutilisedBase * rates.commitFeeRateBps * BigInt(dtSec) + commitFeeRemainderIn
    const commitFee = commitFeeNumerator / DENOM
    const commitFeeRemainder = commitFeeNumerator % DENOM

    // EXCEL BEHAVIOR: Borrow interest accrues on the FULL borrowed base (principal + accrued interest + accrued commit fee)
    // This creates interest-on-interest compounding, matching Excel's discrete compounding on Borrowed$.
    const borrowIntNumerator = borrowedBaseStart * rates.borrowRateBps * BigInt(dtSec) + borrowInterestRemainderIn
    const borrowInterest = borrowIntNumerator / DENOM
    const borrowInterestRemainder = borrowIntNumerator % DENOM

    // Clamp deltas to >= 0 (should already be >= 0, but ensure it)
    const commitFeeClamped = commitFee < 0n ? 0n : commitFee
    const borrowInterestClamped = borrowInterest < 0n ? 0n : borrowInterest

    // Detailed logging is handled by eerLog() in the calling code (debug-gated)

    return { commitFee: commitFeeClamped, borrowInterest: borrowInterestClamped, dtSec, commitFeeRemainder, borrowInterestRemainder }
  }

  // ============================================================================
  // Process ALL configured vaults in this update window
  // ============================================================================
  for (const addr of configuredVaultAddrs) {
    // --------------------------------------------------------------------------
    // Load vault (ensure baseToken)
    // --------------------------------------------------------------------------
    let vault = portVaults.get(addr) ?? null
    if (!vault || !vault.baseToken) {
      vault = await portService.getPortVaultByAddress(ctx, addr)
      if (!vault) continue
      if (!vault.baseToken) {
        vault = await portService.getPortVaultByAddress(ctx, addr)
        if (!vault) continue
      }
      portVaults.set(vault.address.toLowerCase(), vault)
    }

    // --------------------------------------------------------------------------
    // Load EER entity
    // --------------------------------------------------------------------------
    let eer = expectedExchangeRates.get(vault.id)
    if (!eer) {
      eer = await ctx.store.get(ExpectedExchangeRate, vault.id)
      if (!eer) {
        throwError(`ExpectedExchangeRate not found for vault ${vault.address}`, 'updateExpectedExchangeRateForVaults')
      }
      expectedExchangeRates.set(eer.id, eer)
    }

    // --------------------------------------------------------------------------
    // Restart-safe per-vault update gating (persisted) - uses deterministic cutoff
    // --------------------------------------------------------------------------
    const vaultLastUpdateTs = eer.expectedLastUpdateTs ?? 0
    const expectedLastAccrualTs = eer.expectedLastAccrualTs ?? cutoffTs
    
    if (vaultLastUpdateTs > cutoffTs) {
      ctx.log.warn(
        `[EER BACKFILL RESET] vault=${vault.address} stored expectedLastUpdateTs=${vaultLastUpdateTs} > cutoffTs=${cutoffTs}`
      )
      eer.expectedLastUpdateTs = Math.max(0, cutoffTs - timeWindowSeconds)
      // Also reset accrual cursor to be consistent (prevent time going backwards)
      // CRITICAL: Reset to window boundary
      const currentAccrualTs = eer.expectedLastAccrualTs ?? cutoffTs
      eer.expectedLastAccrualTs = Math.min(currentAccrualTs, cutoffTs)
    }
    
    // CRITICAL: Only run update when cutoffTs > expectedLastUpdateTs
    // This ensures we only process when we've moved to a new time window.
    // Note: expectedLastAccrualTs tracks the last EVENT (for simple interest),
    // while expectedLastUpdateTs tracks the last window we processed.
    const vaultLastUpdateTsForGate = eer.expectedLastUpdateTs ?? 0
    if (cutoffTs <= vaultLastUpdateTsForGate) {
      ctx.log.info(
        `[EER VAULT SKIP] vault=${vault.address} cutoffTs=${cutoffTs} expectedLastUpdateTs=${vaultLastUpdateTsForGate} ` +
        `(cutoffTs <= expectedLastUpdateTs, skipping update)`
      )
      continue
    }

    // --------------------------------------------------------------------------
    // Initialize tracked state from entity
    // --------------------------------------------------------------------------
    const shareDecFactor = 10n ** BigInt(vault.decimals)

    let totalSharesTracked = eer.totalSharesTracked ?? 0n
    let borrowedPrincipalBaseTracked = eer.expectedBorrowedPrincipalBaseRaw ?? 0n

    // Load invested funds and accrued values from entity
    let investedBaseTracked = eer.investedBaseTracked ?? 0n
    investedBaseTracked = clamp0(investedBaseTracked)

    let accruedCommitmentFeeBase = eer.accruedCommitmentFeeBase ?? 0n
    let accruedBorrowInterestBase = eer.accruedBorrowInterestBase ?? 0n

    // Load remainder accumulators (prevents BigInt truncation drift with small amounts / short windows)
    let commitFeeRemainderNumerator = eer.commitFeeRemainderNumerator ?? 0n
    let borrowInterestRemainderNumerator = eer.borrowInterestRemainderNumerator ?? 0n

    // Load idle with Option A fallback: idle = netAssets - invested - borrowedBase
    const borrowedBaseForIdleFallback = computeLocalBorrowedBase(borrowedPrincipalBaseTracked, accruedBorrowInterestBase, accruedCommitmentFeeBase)
    let idleBaseTracked =
      eer.idleBaseTracked ??
      ((eer.netAssetsTrackedBaseRaw ?? 0n) - investedBaseTracked - borrowedBaseForIdleFallback)

    idleBaseTracked = clamp0(idleBaseTracked)

    // Initialize lastAccrualTs from entity, defaulting to cutoffTs if not set
    // This ensures we start from the correct window boundary
    // CRITICAL: Capture before value for snapshot debugging
    const lastAccrualTs_before = expectedLastAccrualTs
    let lastAccrualTs = expectedLastAccrualTs

    // --------------------------------------------------------------------------
    // CRITICAL: Enforce exactly ONE accrual per window to prevent double-accrual
    // when running on every block (includeAllBlocks)
    // --------------------------------------------------------------------------
    // Only accrue if we haven't already accrued to this window's end
    if (lastAccrualTs >= windowEndTs) {
      ctx.log.info(
        `[EER ACCRUAL SKIP] vault=${vault.address} lastAccrualTs=${lastAccrualTs} windowEndTs=${windowEndTs} ` +
        `cutoffTs=${cutoffTs} (already accrued to this window, skipping)`
      )
      // Still process events and update state, but skip accrual
      // Continue to event processing below
    }

    // --------------------------------------------------------------------------
    // Month-to-date tracking: initialize and handle rollover
    // --------------------------------------------------------------------------
    const monthStartTs = floorToMonthUTC(hourTs)
    let commitFeeAccruedMtdBase = eer.commitmentFeeAccruedMtdBaseRaw ?? 0n
    let borrowInterestAccruedMtdBase = eer.borrowInterestAccruedMtdBaseRaw ?? 0n
    // Use commitmentFeeMtdMonthStartTs as the source of truth (both fees share the same month window)
    let mtdMonthStartTs = eer.commitmentFeeMtdMonthStartTs ?? monthStartTs

    // CRITICAL: Month rollover check - reset MTD counters if month changed
    if (mtdMonthStartTs !== monthStartTs) {
      ctx.log.info(
        `[EER MONTH ROLLOVER] vault=${vault.address} hourTs=${hourTs} ` +
        `oldMonthStart=${mtdMonthStartTs} newMonthStart=${monthStartTs} ` +
        `resetting MTD counters`
      )
      mtdMonthStartTs = monthStartTs
      commitFeeAccruedMtdBase = 0n
      borrowInterestAccruedMtdBase = 0n
    }

    // Per-update counters (reset each update)
    let commitFeeAccruedThisHour = 0n
    let borrowInterestAccruedThisHour = 0n

    const prevEER = eer.expectedExchangeRateBaseRaw ?? shareDecFactor
    const prevNetAssets = eer.netAssetsTrackedBaseRaw ?? eer.expectedAssetsBaseRaw ?? 0n

    // Debug log: cutoffTs, hourTs, and event filter bounds
    ctx.log.info(
      `[EER CUTOFF DEBUG] vault=${vault.address} cutoffTs=${cutoffTs} hourTs=${hourTs} ` +
      `eventFilterBounds: lastAccrualTs=${lastAccrualTs} cutoffTs=${cutoffTs} (events with ts > ${lastAccrualTs} && ts <= ${cutoffTs})`
    )

    ctx.log.info(
      `[EER UPDATE START] vault=${vault.address} updateTs=${cutoffTs} ` +
        `lastAccrualTs=${lastAccrualTs} ` +
        `shares=${totalSharesTracked.toString()} idle=${idleBaseTracked.toString()} invested=${investedBaseTracked.toString()} borrowed=${borrowedPrincipalBaseTracked.toString()} ` +
        `prevNetAssets=${prevNetAssets.toString()} prevEER=${prevEER.toString()}`
    )

    eerLog(ctx, vault.address,
      `[EER VAULT START] vault=${vault.address} vaultId=${vault.id} hourTs=${hourTs} cutoffTs=${cutoffTs} block=${blockHeight} ` +
      `baseToken=${vault.baseToken.address} baseDecimals=${vault.baseToken.decimals} ` +
      `lastUpdateTs=${eer.expectedLastUpdateTs ?? 0} lastAccrualTs=${lastAccrualTs} ` +
      `shares=${fmtBig(totalSharesTracked)} idle=${fmtBig(idleBaseTracked)} invested=${fmtBig(investedBaseTracked)} principal=${fmtBig(borrowedPrincipalBaseTracked)} ` +
      `accCommitFee=${fmtBig(accruedCommitmentFeeBase)} accBorrowInt=${fmtBig(accruedBorrowInterestBase)} ` +
      `prevNetAssets=${fmtBig(prevNetAssets)} prevEER=${fmtBig(prevEER)}`
    )

    // --------------------------------------------------------------------------
    // Load latest strategy position snapshots EARLY (before event processing)
    // This allows us to use effectiveStrategyValueBase (current value) instead of
    // investedBaseTracked (principal only) for commitment fee accrual and utilization
    // --------------------------------------------------------------------------
    const snapResult = await strategyService.getLatestStrategyValueForVault(ctx, vault, hourTs)

    // --------------------------------------------------------------------------
    // Determine effective strategy value (invested principal + strategy yield).
    //
    // CRITICAL FIX: Persist strategy yield separately to prevent yield loss when
    // effectiveStrategyValueBase is reloaded between updates. Without this fix,
    // after a FUNDS_DIVERTED event, the next update's max(snapshot, invested) would
    // lose the yield component when invested > snapshot (because the snapshot hasn't
    // been updated to reflect the new diversion yet). This caused EER to decrease
    // with smaller update windows (5min vs 60min).
    //
    // The yield is only recomputed when a NEW snapshot arrives (snapshotTs changes).
    // Between snapshots, the persisted yield is preserved across updates.
    // --------------------------------------------------------------------------
    let strategyYieldBase = eer.strategyYieldBase ?? 0n
    const lastSnapshotTsUsed = eer.lastSnapshotTsUsed ?? 0
    let newLastSnapshotTsUsed = lastSnapshotTsUsed

    // Only recompute yield when a NEW fresh snapshot is available
    if (
      snapResult.snapshotTs !== null &&
      snapResult.snapshotTs > lastSnapshotTsUsed &&
      snapResult.snapshotFresh &&
      snapResult.strategyValueBase !== null
    ) {
      // New snapshot: yield = max(0, snapshot - invested)
      strategyYieldBase = snapResult.strategyValueBase > investedBaseTracked
        ? snapResult.strategyValueBase - investedBaseTracked
        : 0n
      newLastSnapshotTsUsed = snapResult.snapshotTs
    }

    // Effective strategy value = invested principal + accumulated yield
    let effectiveStrategyValueBase = investedBaseTracked === 0n
      ? 0n
      : investedBaseTracked + strategyYieldBase

    const snapshotAgeHours = snapResult.snapshotTs !== null
      ? ((hourTs - snapResult.snapshotTs) / 3600).toFixed(2)
      : 'N/A'

    eerLog(ctx, vault.address,
      `[EER STRATEGY SNAPSHOTS EARLY] vault=${vault.address} hourTs=${hourTs} ` +
      `snapshotsFound=${snapResult.snapshotsFound} uniqueStrategies=${snapResult.uniqueStrategies} ` +
      `snapshotTs=${snapResult.snapshotTs ?? 'null'} snapshotAgeHours=${snapshotAgeHours} snapshotFresh=${snapResult.snapshotFresh} ` +
      `strategyValueBase=${snapResult.strategyValueBase !== null ? fmtBig(snapResult.strategyValueBase) : 'null'} ` +
      `investedBaseTracked=${fmtBig(investedBaseTracked)} strategyYieldBase=${fmtBig(strategyYieldBase)} ` +
      `lastSnapshotTsUsed=${lastSnapshotTsUsed} newLastSnapshotTsUsed=${newLastSnapshotTsUsed} ` +
      `effectiveStrategyValueBase=${fmtBig(effectiveStrategyValueBase)} (will be used for commitment fee accrual)`
    )

    // --------------------------------------------------------------------------
    // Drain inbox events (processable: lastAccrualTs < ts <= cutoffTs), deterministic sort
    // --------------------------------------------------------------------------
    const inbox = parserEerState.get(vault.id)
    const allEvents = inbox?.events ?? []
    
    // Inbox inspection: count by kind, min/max ts
    const byKind: Record<string, number> = { ENTER: 0, EXIT: 0, DRAWDOWN: 0, TOPUP: 0, FUNDS_DIVERTED: 0, FUNDS_REVERTED: 0 }
    let minTs = Infinity
    let maxTs = -Infinity
    for (const e of allEvents) {
      byKind[e.kind] = (byKind[e.kind] || 0) + 1
      if (e.ts < minTs) minTs = e.ts
      if (e.ts > maxTs) maxTs = e.ts
    }
    
    eerLog(ctx, vault.address,
      `[EER INBOX SCAN] vault=${vault.address} hourTs=${hourTs} cutoffTs=${cutoffTs} total=${allEvents.length} ` +
      `byKind=${j(byKind)} minTs=${minTs === Infinity ? 'none' : minTs} maxTs=${maxTs === -Infinity ? 'none' : maxTs}`
    )

    // EVM-canonical ordering: (ts, blockHeight, logIndex, txHash)
    // This ensures events are processed in the exact order they occurred on-chain
    const events = allEvents
      .filter((e) => e.ts > lastAccrualTs && e.ts <= cutoffTs)
      .sort((a, b) => {
        // 1. Sort by timestamp (seconds)
        if (a.ts !== b.ts) return a.ts - b.ts
        // 2. Sort by block height (numeric) - handles same-second blocks
        if (a.blockHeight !== b.blockHeight) return a.blockHeight - b.blockHeight
        // 3. Sort by logIndex (numeric) - handles same-block events
        const aLogIndex = a.logIndex ?? 0
        const bLogIndex = b.logIndex ?? 0
        if (aLogIndex !== bLogIndex) return aLogIndex - bLogIndex
        // 4. Final tie-breaker: txHash (string comparison)
        return (a.txHash ?? '').localeCompare(b.txHash ?? '')
      })

    ctx.log.info(
      `[EER UPDATE INBOX] vault=${vault.address} updateTs=${cutoffTs} totalEvents=${allEvents.length} processable=${events.length}`
    )
    
    eerLog(ctx, vault.address,
      `[EER INBOX FILTER] vault=${vault.address} cutoffTs=${cutoffTs} lastAccrualTs=${lastAccrualTs} ` +
      `processable=${events.length}`
    )
    
    // Log first 5 and last 5 events for ordering verification
    if (events.length > 0) {
      const head = events.slice(0, 5)
      const tail = events.slice(-5)
      eerLog(ctx, vault.address,
        `[EER INBOX HEAD] vault=${vault.address} cutoffTs=${cutoffTs} head=${j(head.map(e => ({ kind: e.kind, ts: e.ts, block: e.blockHeight, tx: e.txHash, idx: e.logIndex })))}`
      )
      if (events.length > 5) {
        eerLog(ctx, vault.address,
          `[EER INBOX TAIL] vault=${vault.address} cutoffTs=${cutoffTs} tail=${j(tail.map(e => ({ kind: e.kind, ts: e.ts, block: e.blockHeight, tx: e.txHash, idx: e.logIndex })))}`
        )
      }
    }

    // --------------------------------------------------------------------------
    // Get borrow rate (constant for entire window)
    // --------------------------------------------------------------------------
    const eerCfg = getEERConfigForVault(config, vault.address)
    if (!eerCfg) throw new Error(`EER config not found for vault=${vault.address}`)
    const borrowRateBps = BigInt(eerCfg.borrowRateBps)

    // --------------------------------------------------------------------------
    // Piecewise accrual with dynamic tier recomputation (Excel parity)
    // CRITICAL: Tier is recomputed BEFORE each segment using state at segment start
    // This ensures tier changes mid-hour when utilization changes due to events
    // --------------------------------------------------------------------------
    for (const ev of events) {
      // EXCEL BEHAVIOR: Compute tier using state at START of this segment (before accrual)
      // This matches Excel which recomputes utilization + tier after each event
      const borrowedForTierSeg = borrowedPrincipalBaseTracked + accruedBorrowInterestBase
      const totalForTierSeg = idleBaseTracked + effectiveStrategyValueBase + borrowedForTierSeg
      let utilForTierBpsSeg = 0n
      if (totalForTierSeg > 0n) {
        // Floor division: utilForTierBpsSeg = floor(borrowedForTierSeg * 10000 / totalForTierSeg)
        utilForTierBpsSeg = (borrowedForTierSeg * BPS_DENOMINATOR) / totalForTierSeg
      }
      const commitFeeRateBpsSeg = getCommitmentFeeRateBps(utilForTierBpsSeg)
      
      // Rates for this segment (tier recomputed, borrow rate constant)
      const rates: FeeRates = {
        commitFeeRateBps: commitFeeRateBpsSeg,
        borrowRateBps: borrowRateBps
      }
      
      // EXCEL BEHAVIOR: Compute borrowedBaseStart = principal + accruedBorrowInterest + accruedCommitmentFee
      // Borrow interest accrues on this full base (interest-on-interest compounding)
      const borrowedBaseStart = borrowedPrincipalBaseTracked + accruedBorrowInterestBase + accruedCommitmentFeeBase
      
      eerLog(ctx, vault.address,
        `[EER ACCRUE SEG] vault=${vault.address} hourTs=${hourTs} from=${lastAccrualTs} to=${ev.ts} ` +
        `dt=${ev.ts - lastAccrualTs} idle=${fmtBig(idleBaseTracked)} divertedValue=${fmtBig(effectiveStrategyValueBase)} principal=${fmtBig(borrowedPrincipalBaseTracked)} ` +
        `borrowedForTier=${fmtBig(borrowedForTierSeg)} totalForTier=${fmtBig(totalForTierSeg)} ` +
        `utilForTierBps=${utilForTierBpsSeg.toString()} commitFeeRateBps=${commitFeeRateBpsSeg.toString()} ` +
        `borrowedBaseStart=${fmtBig(borrowedBaseStart)} rates={commitFeeBps=${fmtBig(rates.commitFeeRateBps)},borrowRateBps=${fmtBig(rates.borrowRateBps)}}`
      )
      
      const { commitFee, borrowInterest, dtSec, commitFeeRemainder, borrowInterestRemainder } = accrueFeesBetween(
        vault.address,
        lastAccrualTs,
        ev.ts,
        idleBaseTracked,
        effectiveStrategyValueBase, // Use current diverted value, not just principal
        borrowedBaseStart, // EXCEL: interest accrues on full borrowedBase (principal + interest + commitFee)
        rates,
        commitFeeRemainderNumerator,
        borrowInterestRemainderNumerator
      )
      commitFeeRemainderNumerator = commitFeeRemainder
      borrowInterestRemainderNumerator = borrowInterestRemainder

      eerLog(ctx, vault.address,
        `[EER ACCRUE SEG] vault=${vault.address} hourTs=${hourTs} delta={commitFee=${fmtBig(commitFee)},borrowInt=${fmtBig(borrowInterest)}} ` +
        `accAfter={commitFee=${fmtBig(accruedCommitmentFeeBase + commitFee)},borrowInt=${fmtBig(accruedBorrowInterestBase + borrowInterest)}}`
      )

      // Update lifetime totals
      accruedCommitmentFeeBase += commitFee
      accruedBorrowInterestBase += borrowInterest
      
      // Update MTD counters
      commitFeeAccruedMtdBase += commitFee
      borrowInterestAccruedMtdBase += borrowInterest
      
      // Update per-update counters
      commitFeeAccruedThisHour += commitFee
      borrowInterestAccruedThisHour += borrowInterest
      
      lastAccrualTs = ev.ts
      
      // Log state before applying event
      eerLog(ctx, vault.address,
        `[EER APPLY BEFORE] vault=${vault.address} hourTs=${hourTs} kind=${ev.kind} ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
        `shares=${fmtBig(totalSharesTracked)} idle=${fmtBig(idleBaseTracked)} invested=${fmtBig(investedBaseTracked)} principal=${fmtBig(borrowedPrincipalBaseTracked)} ` +
        `accruedCommitFee=${fmtBig(accruedCommitmentFeeBase)} accruedBorrowInt=${fmtBig(accruedBorrowInterestBase)} ` +
        `lastAccrualTs=${lastAccrualTs}`
      )

      // Apply event
      if (ev.kind === 'ENTER') {
        eerLog(ctx, vault.address,
          `[EER APPLY EVENT] vault=${vault.address} hourTs=${hourTs} kind=ENTER ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
          `sharesDelta=${fmtBig(ev.sharesDelta)} assetsDeltaBase=${fmtBig(ev.assetsDeltaBase)}`
        )
        totalSharesTracked += ev.sharesDelta
        idleBaseTracked += ev.assetsDeltaBase
        idleBaseTracked = clamp0(idleBaseTracked)
      } else if (ev.kind === 'EXIT') {
        eerLog(ctx, vault.address,
          `[EER APPLY EVENT] vault=${vault.address} hourTs=${hourTs} kind=EXIT ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
          `sharesDelta=${fmtBig(ev.sharesDelta)} assetsDeltaBase=${fmtBig(ev.assetsDeltaBase)}`
        )
        // sharesDelta and assetsDeltaBase are negative in the event
        totalSharesTracked = totalSharesTracked > -ev.sharesDelta ? totalSharesTracked + ev.sharesDelta : 0n
        idleBaseTracked = idleBaseTracked >= -ev.assetsDeltaBase ? idleBaseTracked + ev.assetsDeltaBase : 0n
      } else if (ev.kind === 'DRAWDOWN') {
        eerLog(ctx, vault.address,
          `[EER APPLY EVENT] vault=${vault.address} hourTs=${hourTs} kind=DRAWDOWN ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
          `token=${ev.token} amountRaw=${fmtBig(ev.amountRaw)} amountBase=${fmtBig(ev.amountBase)} tokenDecimals=${ev.tokenDecimals}`
        )
        idleBaseTracked = idleBaseTracked >= ev.amountBase ? idleBaseTracked - ev.amountBase : 0n
        borrowedPrincipalBaseTracked += ev.amountBase

        // Update aggregate BorrowedAssetBalance (one per vault, base-denominated)
        // Track aggregate principal only, not per-token balances
        const cfg = getEERConfigForVault(config, vault.address)
        if (cfg) {
          // Use vault ID as balance ID (aggregate per vault)
          const balanceId = vault.id

          let bal = borrowedBalances.get(balanceId)
          if (!bal) bal = await ctx.store.get(BorrowedAssetBalance, balanceId)
          
          const balBeforeBase = bal?.amountBaseRaw ?? 0n

          if (!bal) {
            bal = new BorrowedAssetBalance({
              id: balanceId,
              vault,
              vaultAddress: vault.address.toLowerCase(),
              borrower: cfg.borrower.toLowerCase(),
              token: vault.baseToken.address.toLowerCase(), // Use base token for aggregate tracking
              tokenDecimals: Number(vault.baseToken.decimals),
              amountRaw: 0n,
              amountBaseRaw: 0n,
              updatedAtTs: BigInt(ev.ts * 1000),
              lastTxHash: ev.txHash ?? '',
            })
          }

          bal.amountBaseRaw += ev.amountBase
          // For aggregate tracking, amountRaw tracks base token amount
          bal.amountRaw += ev.amountBase
          bal.updatedAtTs = BigInt(ev.ts * 1000)
          bal.lastTxHash = ev.txHash ?? ''
          borrowedBalances.set(balanceId, bal)
          
          eerLog(ctx, vault.address,
            `[EER BORROWBAL] vault=${vault.address} hourTs=${hourTs} id=${balanceId} aggregate ` +
            `before={base=${fmtBig(balBeforeBase)}} ` +
            `after={base=${fmtBig(bal.amountBaseRaw)}}`
          )
        }
      } else if (ev.kind === 'TOPUP') {
        // Clamp applied repayment to outstanding principal
        // Only the applied portion moves from borrowedPrincipal → idle (preserves net assets)
        const applied = borrowedPrincipalBaseTracked > ev.amountBase ? ev.amountBase : borrowedPrincipalBaseTracked
        const excess = ev.amountBase - applied
        
        eerLog(ctx, vault.address,
          `[EER APPLY EVENT] vault=${vault.address} hourTs=${hourTs} kind=TOPUP ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
          `amountBase=${fmtBig(ev.amountBase)} principalBefore=${fmtBig(borrowedPrincipalBaseTracked)} applied=${fmtBig(applied)} excess=${fmtBig(excess)}`
        )
        
        if (excess > 0n) {
          ctx.log.warn(
            `[EER TOPUP EXCESS] vault=${vault.address} hourTs=${hourTs} ts=${ev.ts} tx=${ev.txHash} ` +
            `amountBase=${fmtBig(ev.amountBase)} applied=${fmtBig(applied)} excess=${fmtBig(excess)} (ignored)`
          )
        }
        
        borrowedPrincipalBaseTracked -= applied

        // Only add applied amount to idle (excess is ignored to preserve net assets)
        idleBaseTracked += applied

        // Update aggregate BorrowedAssetBalance (one per vault, base-denominated)
        // Reduce aggregate principal by applied amount
        const cfg = getEERConfigForVault(config, vault.address)
        if (cfg) {
          // Use vault ID as balance ID (aggregate per vault)
          const balanceId = vault.id

          let bal = borrowedBalances.get(balanceId)
          if (!bal) bal = await ctx.store.get(BorrowedAssetBalance, balanceId)

          if (bal) {
            const balBeforeBase = bal.amountBaseRaw
            bal.amountBaseRaw = bal.amountBaseRaw > applied ? bal.amountBaseRaw - applied : 0n
            bal.amountRaw = bal.amountRaw > applied ? bal.amountRaw - applied : 0n
            bal.updatedAtTs = BigInt(ev.ts * 1000)
            bal.lastTxHash = ev.txHash ?? ''
            borrowedBalances.set(balanceId, bal)
            
            eerLog(ctx, vault.address,
              `[EER BORROWBAL] vault=${vault.address} hourTs=${hourTs} id=${balanceId} aggregate ` +
              `before={base=${fmtBig(balBeforeBase)}} ` +
              `after={base=${fmtBig(bal.amountBaseRaw)}}`
            )
          } else if (applied > 0n) {
            // Should not happen, but log if we're applying repayment but balance doesn't exist
            ctx.log.warn(
              `[EER BORROWBAL WARN] vault=${vault.address} hourTs=${hourTs} TOPUP applied=${fmtBig(applied)} but no BorrowedAssetBalance found`
            )
          }
        }
      } else if (ev.kind === 'FUNDS_DIVERTED') {
        // Move funds from idle → invested
        // applied = min(idle, amountBase) to prevent negative idle
        const applied = idleBaseTracked > ev.amountBase ? ev.amountBase : idleBaseTracked
        
        eerLog(ctx, vault.address,
          `[EER APPLY EVENT] vault=${vault.address} hourTs=${hourTs} kind=FUNDS_DIVERTED ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
          `amountBase=${fmtBig(ev.amountBase)} strategy=${ev.strategy} idleBefore=${fmtBig(idleBaseTracked)} applied=${fmtBig(applied)} investedBefore=${fmtBig(investedBaseTracked)} effectiveStrategyValueBefore=${fmtBig(effectiveStrategyValueBase)}`
        )
        
        if (applied < ev.amountBase) {
          ctx.log.warn(
            `[EER FUNDS_DIVERTED CLAMP] vault=${vault.address} hourTs=${hourTs} ts=${ev.ts} tx=${ev.txHash} ` +
            `amountBase=${fmtBig(ev.amountBase)} applied=${fmtBig(applied)} idleBefore=${fmtBig(idleBaseTracked)} (clamped to available idle)`
          )
        }
        
        idleBaseTracked -= applied
        idleBaseTracked = clamp0(idleBaseTracked)
        investedBaseTracked += applied
        
        // CRITICAL: Keep effectiveStrategyValueBase in sync with investedBaseTracked changes
        // When funds are diverted, the effective strategy value increases by the same amount
        // (newly diverted funds start at principal value, will grow with strategy returns over time)
        effectiveStrategyValueBase += applied

        // Keep strategyYieldBase in sync (yield is unchanged by diversion)
        strategyYieldBase = effectiveStrategyValueBase > investedBaseTracked
          ? effectiveStrategyValueBase - investedBaseTracked
          : 0n

        eerLog(ctx, vault.address,
          `[EER FUNDS_DIVERTED SYNC] vault=${vault.address} hourTs=${hourTs} ts=${ev.ts} ` +
          `effectiveStrategyValueBase updated: ${fmtBig(effectiveStrategyValueBase - applied)} → ${fmtBig(effectiveStrategyValueBase)} (delta=${fmtBig(applied)})`
        )
      } else if (ev.kind === 'FUNDS_REVERTED') {
        // Move funds from invested → idle, PRESERVING YIELD
        // 
        // When funds are reverted from a strategy (e.g., Aave withdraw), the returned amount
        // may exceed the original principal due to strategy returns (yield).
        // 
        // Excel behavior: the full returned amount increases NAV/idle, yield is implicitly captured.
        // 
        // principalReturn = min(investedBaseTracked, amountBase) - how much principal we can return
        // yield = amountBase - principalReturn - extra yield from strategy (if any)
        // 
        // investedBaseTracked tracks PRINCIPAL only, so we reduce it by principalReturn
        // idleBaseTracked receives the FULL amount (principal + yield)
        // effectiveStrategyValueBase decreases by the FULL amount (entire position is gone)
        const principalReturn = investedBaseTracked > ev.amountBase ? ev.amountBase : investedBaseTracked
        const strategyYield = ev.amountBase - principalReturn
        
        eerLog(ctx, vault.address,
          `[EER APPLY EVENT] vault=${vault.address} hourTs=${hourTs} kind=FUNDS_REVERTED ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
          `amountBase=${fmtBig(ev.amountBase)} strategy=${ev.strategy} investedBefore=${fmtBig(investedBaseTracked)} ` +
          `principalReturn=${fmtBig(principalReturn)} strategyYield=${fmtBig(strategyYield)} ` +
          `idleBefore=${fmtBig(idleBaseTracked)} effectiveStrategyValueBefore=${fmtBig(effectiveStrategyValueBase)}`
        )
        
        if (strategyYield > 0n) {
          ctx.log.info(
            `[EER FUNDS_REVERTED YIELD] vault=${vault.address} hourTs=${hourTs} ts=${ev.ts} tx=${ev.txHash} ` +
            `amountBase=${fmtBig(ev.amountBase)} principalReturn=${fmtBig(principalReturn)} strategyYield=${fmtBig(strategyYield)} ` +
            `(yield preserved and added to idle)`
          )
        }
        
        // Reduce invested principal by principalReturn only
        investedBaseTracked -= principalReturn
        investedBaseTracked = clamp0(investedBaseTracked)
        
        // Add FULL returned amount to idle (principal + yield)
        // This preserves yield in NAV as per Excel behavior
        idleBaseTracked += ev.amountBase
        
        // CRITICAL: Reduce effectiveStrategyValueBase by FULL amount (entire position is gone)
        // The strategy position no longer exists, so the whole value is removed
        effectiveStrategyValueBase = effectiveStrategyValueBase >= ev.amountBase
          ? effectiveStrategyValueBase - ev.amountBase
          : 0n

        // Keep strategyYieldBase in sync after revert
        strategyYieldBase = effectiveStrategyValueBase > investedBaseTracked
          ? effectiveStrategyValueBase - investedBaseTracked
          : 0n

        eerLog(ctx, vault.address,
          `[EER FUNDS_REVERTED SYNC] vault=${vault.address} hourTs=${hourTs} ts=${ev.ts} ` +
          `investedBaseTracked updated: ${fmtBig(investedBaseTracked + principalReturn)} → ${fmtBig(investedBaseTracked)} (delta=-${fmtBig(principalReturn)}) ` +
          `idleBaseTracked updated: ${fmtBig(idleBaseTracked - ev.amountBase)} → ${fmtBig(idleBaseTracked)} (delta=+${fmtBig(ev.amountBase)}) ` +
          `effectiveStrategyValueBase updated: ${fmtBig(effectiveStrategyValueBase + ev.amountBase)} → ${fmtBig(effectiveStrategyValueBase)} (delta=-${fmtBig(ev.amountBase)}) ` +
          `strategyYieldBase=${fmtBig(strategyYieldBase)}`
        )
      }
      
      // Log state after applying event
      // Compute current net assets for logging (using effectiveStrategyValueBase which is kept in sync during event processing)
      const currentNetAssets = computeNetAssets(
        idleBaseTracked,
        effectiveStrategyValueBase, // Current diverted value, kept in sync with investedBaseTracked
        borrowedPrincipalBaseTracked,
        accruedBorrowInterestBase,
        accruedCommitmentFeeBase
      )
      const currentEER = computeExchangeRate(currentNetAssets, totalSharesTracked, shareDecFactor)
      
      eerLog(ctx, vault.address,
        `[EER APPLY AFTER] vault=${vault.address} hourTs=${hourTs} kind=${ev.kind} ts=${ev.ts} tx=${ev.txHash} idx=${ev.logIndex} ` +
        `shares=${fmtBig(totalSharesTracked)} idle=${fmtBig(idleBaseTracked)} invested=${fmtBig(investedBaseTracked)} principal=${fmtBig(borrowedPrincipalBaseTracked)} ` +
        `accruedCommitFee=${fmtBig(accruedCommitmentFeeBase)} accruedBorrowInt=${fmtBig(accruedBorrowInterestBase)} ` +
        `netAssets=${fmtBig(currentNetAssets)} eer=${fmtBig(currentEER)} lastAccrualTs=${lastAccrualTs}`
      )
    }

    // Remove processed events from inbox: keep only future events
    if (inbox) {
      inbox.events = allEvents.filter((e) => e.ts > cutoffTs)
    }

    // --------------------------------------------------------------------------
    // SIMPLE INTEREST: Save "base" state after event processing.
    // The base state is compounded ONLY at events (matching Excel behavior).
    // The final segment below computes display-only values (for EER/snapshots)
    // but these are NOT persisted to the accrual base, preventing inter-window
    // compounding. Each subsequent window recomputes from this base using simple
    // interest over the full elapsed time since the last event.
    // --------------------------------------------------------------------------
    const baseAccruedCommitFee = accruedCommitmentFeeBase
    const baseAccruedBorrowInterest = accruedBorrowInterestBase
    const baseLastAccrualTs = lastAccrualTs
    const baseCommitFeeRemainder = commitFeeRemainderNumerator
    const baseBorrowInterestRemainder = borrowInterestRemainderNumerator
    const baseMtdCommitFee = commitFeeAccruedMtdBase
    const baseMtdBorrowInterest = borrowInterestAccruedMtdBase

    // --------------------------------------------------------------------------
    // Accrue fees from lastAccrualTs -> windowEndTs (final segment after all events)
    // CRITICAL:
    // 1. Recompute tier using state at START of this final segment (Excel parity)
    // 2. Accrue ONLY to windowEndTs (not to cutoffTs/blockTs) to prevent double-accrual
    // 3. This computes DISPLAY values only — base values are NOT updated
    // --------------------------------------------------------------------------
    let finalDtSec = 0 // Track dtSeconds for final accrual segment (for snapshot debugging)
    let finalCommitFeeRateBps = 0n // Track final tier for snapshot
    if (lastAccrualTs < windowEndTs) {
      // EXCEL BEHAVIOR: Compute tier using state at START of final segment (after all events)
      // This matches Excel which recomputes utilization + tier after each event
      const borrowedForTierFinal = borrowedPrincipalBaseTracked + accruedBorrowInterestBase
      const totalForTierFinal = idleBaseTracked + effectiveStrategyValueBase + borrowedForTierFinal
      let utilForTierBpsFinal = 0n
      if (totalForTierFinal > 0n) {
        // Floor division: utilForTierBpsFinal = floor(borrowedForTierFinal * 10000 / totalForTierFinal)
        utilForTierBpsFinal = (borrowedForTierFinal * BPS_DENOMINATOR) / totalForTierFinal
      }
      finalCommitFeeRateBps = getCommitmentFeeRateBps(utilForTierBpsFinal)
      
      // Rates for final segment (tier recomputed, borrow rate constant)
      const rates: FeeRates = {
        commitFeeRateBps: finalCommitFeeRateBps,
        borrowRateBps: borrowRateBps
      }
      
      // EXCEL BEHAVIOR: Compute borrowedBaseStart = principal + accruedBorrowInterest + accruedCommitmentFee
      // Borrow interest accrues on this full base (interest-on-interest compounding)
      const borrowedBaseStartFinal = borrowedPrincipalBaseTracked + accruedBorrowInterestBase + accruedCommitmentFeeBase
      
      eerLog(ctx, vault.address,
        `[EER ACCRUE SEG] vault=${vault.address} hourTs=${hourTs} cutoffTs=${cutoffTs} windowEndTs=${windowEndTs} ` +
        `from=${lastAccrualTs} to=${windowEndTs} dt=${windowEndTs - lastAccrualTs} ` +
        `idle=${fmtBig(idleBaseTracked)} divertedValue=${fmtBig(effectiveStrategyValueBase)} principal=${fmtBig(borrowedPrincipalBaseTracked)} ` +
        `borrowedForTier=${fmtBig(borrowedForTierFinal)} totalForTier=${fmtBig(totalForTierFinal)} ` +
        `utilForTierBps=${utilForTierBpsFinal.toString()} commitFeeRateBps=${finalCommitFeeRateBps.toString()} ` +
        `borrowedBaseStart=${fmtBig(borrowedBaseStartFinal)} rates={commitFeeBps=${fmtBig(rates.commitFeeRateBps)},borrowRateBps=${fmtBig(rates.borrowRateBps)}}`
      )
      
      const { commitFee, borrowInterest, dtSec, commitFeeRemainder, borrowInterestRemainder } = accrueFeesBetween(
        vault.address,
        lastAccrualTs,
        windowEndTs, // CRITICAL: Accrue to windowEndTs, NOT cutoffTs
        idleBaseTracked,
        effectiveStrategyValueBase, // Use current diverted value, not just principal
        borrowedBaseStartFinal, // EXCEL: interest accrues on full borrowedBase (principal + interest + commitFee)
        rates,
        commitFeeRemainderNumerator,
        borrowInterestRemainderNumerator
      )
      commitFeeRemainderNumerator = commitFeeRemainder
      borrowInterestRemainderNumerator = borrowInterestRemainder
      finalDtSec = dtSec // Capture for snapshot

      eerLog(ctx, vault.address,
        `[EER ACCRUE SEG] vault=${vault.address} hourTs=${hourTs} cutoffTs=${cutoffTs} windowEndTs=${windowEndTs} ` +
        `delta={commitFee=${fmtBig(commitFee)},borrowInt=${fmtBig(borrowInterest)}} ` +
        `accAfter={commitFee=${fmtBig(accruedCommitmentFeeBase + commitFee)},borrowInt=${fmtBig(accruedBorrowInterestBase + borrowInterest)}} ` +
        `cursor=${windowEndTs}`
      )

      // Update lifetime totals
      accruedCommitmentFeeBase += commitFee
      accruedBorrowInterestBase += borrowInterest
      
      // Update MTD counters
      commitFeeAccruedMtdBase += commitFee
      borrowInterestAccruedMtdBase += borrowInterest
      
      // Update per-update counters
      commitFeeAccruedThisHour += commitFee
      borrowInterestAccruedThisHour += borrowInterest
      
      // CRITICAL: Set lastAccrualTs to windowEndTs (not cutoffTs) to prevent double-accrual
      lastAccrualTs = windowEndTs
    } else {
      // Already accrued to this window, skip accrual but still process events
      // Compute final tier for snapshot even if no accrual
      const borrowedForTierFinal = borrowedPrincipalBaseTracked + accruedBorrowInterestBase
      const totalForTierFinal = idleBaseTracked + effectiveStrategyValueBase + borrowedForTierFinal
      let utilForTierBpsFinal = 0n
      if (totalForTierFinal > 0n) {
        utilForTierBpsFinal = (borrowedForTierFinal * BPS_DENOMINATOR) / totalForTierFinal
      }
      finalCommitFeeRateBps = getCommitmentFeeRateBps(utilForTierBpsFinal)
      
      ctx.log.info(
        `[EER ACCRUAL ALREADY DONE] vault=${vault.address} lastAccrualTs=${lastAccrualTs} windowEndTs=${windowEndTs} ` +
        `cutoffTs=${cutoffTs} (skipping accrual, processing events only)`
      )
    }

    // Debug log: final "post-accrue-to-cutoff" state (netAssets + eer)
    const finalNetAssets = computeNetAssets(
      idleBaseTracked,
      effectiveStrategyValueBase, // Current diverted value, kept in sync with investedBaseTracked
      borrowedPrincipalBaseTracked,
      accruedBorrowInterestBase,
      accruedCommitmentFeeBase
    )
    const finalEER = computeExchangeRate(finalNetAssets, totalSharesTracked, shareDecFactor)
    ctx.log.info(
      `[EER POST-ACCRUE DEBUG] vault=${vault.address} cutoffTs=${cutoffTs} hourTs=${hourTs} ` +
      `finalNetAssets=${finalNetAssets.toString()} finalEER=${finalEER.toString()} ` +
      `lastAccrualTs=${lastAccrualTs}`
    )

    // --------------------------------------------------------------------------
    // Compute projections to month end
    // --------------------------------------------------------------------------
    const secRemaining = Math.max(0, (monthStartTs + secondsInMonthUTC(monthStartTs)) - hourTs)
    
    // Use current update window's utilization/rates as constant for remaining time
    // Projection formula (same math as accrual but using remaining seconds)
    // CRITICAL: Use final tier (computed at end of window) for projections
    // This matches Excel behavior where projections use the tier from the last segment
    // Commitment fee projection uses unutilized base = idle + divertedValueBase (current diverted value, not just principal)
    const unutilisedBaseForProjection = idleBaseTracked + effectiveStrategyValueBase
    const projectedCommitRemainingBase = secRemaining > 0
      ? (unutilisedBaseForProjection * finalCommitFeeRateBps * BigInt(secRemaining)) / (BPS_DENOMINATOR * SECONDS_PER_YEAR)
      : 0n
    
    const projectedBorrowRemainingBase = secRemaining > 0
      ? (borrowedPrincipalBaseTracked * borrowRateBps * BigInt(secRemaining)) / (BPS_DENOMINATOR * SECONDS_PER_YEAR)
      : 0n
    
    // Clamp projections to >= 0
    const projectedCommitRemainingBaseClamped = projectedCommitRemainingBase < 0n ? 0n : projectedCommitRemainingBase
    const projectedBorrowRemainingBaseClamped = projectedBorrowRemainingBase < 0n ? 0n : projectedBorrowRemainingBase
    
    const commitFeeProjectedMonthEndBase = commitFeeAccruedMtdBase + projectedCommitRemainingBaseClamped
    const borrowInterestProjectedMonthEndBase = borrowInterestAccruedMtdBase + projectedBorrowRemainingBaseClamped

    eerLog(ctx, vault.address,
      `[EER PROJECTION] vault=${vault.address} hourTs=${hourTs} monthStartTs=${monthStartTs} secRemaining=${secRemaining} ` +
      `commitMtd=${fmtBig(commitFeeAccruedMtdBase)} commitProjRemaining=${fmtBig(projectedCommitRemainingBaseClamped)} commitProjMonthEnd=${fmtBig(commitFeeProjectedMonthEndBase)} ` +
      `borrowMtd=${fmtBig(borrowInterestAccruedMtdBase)} borrowProjRemaining=${fmtBig(projectedBorrowRemainingBaseClamped)} borrowProjMonthEnd=${fmtBig(borrowInterestProjectedMonthEndBase)}`
    )

    // --------------------------------------------------------------------------
    // Note: Strategy snapshots were loaded EARLY (before event processing) to enable
    // using effectiveStrategyValueBase (current diverted value) for commitment fee accrual.
    // effectiveStrategyValueBase was computed above and is already available.
    // --------------------------------------------------------------------------

    // --------------------------------------------------------------------------
    // Compute netAssets + exchangeRate
    // --------------------------------------------------------------------------
    const netAssets = computeNetAssets(
      idleBaseTracked,
      effectiveStrategyValueBase,  // Use effective value (snapshot if fresh, otherwise investedBaseTracked with max() safety)
      borrowedPrincipalBaseTracked,
      accruedBorrowInterestBase,
      accruedCommitmentFeeBase
    )
    const expectedExchangeRate = computeExchangeRate(netAssets, totalSharesTracked, shareDecFactor)
    
    // Compute borrowedBase for logging (Option A: netAssets = idle + invested + borrowedBase)
    const borrowedBaseForLog = computeLocalBorrowedBase(borrowedPrincipalBaseTracked, accruedBorrowInterestBase, accruedCommitmentFeeBase)
    
    eerLog(ctx, vault.address,
      `[EER COMPUTE] vault=${vault.address} hourTs=${hourTs} cutoffTs=${cutoffTs} ` +
      `netAssets={idle=${fmtBig(idleBaseTracked)} + invested=${fmtBig(effectiveStrategyValueBase)} + borrowedBase=${fmtBig(borrowedBaseForLog)} => net=${fmtBig(netAssets)}} ` +
      `borrowedBase={principal=${fmtBig(borrowedPrincipalBaseTracked)} + interest=${fmtBig(accruedBorrowInterestBase)} + commitFee=${fmtBig(accruedCommitmentFeeBase)} => ${fmtBig(borrowedBaseForLog)}} ` +
      `shares=${fmtBig(totalSharesTracked)} shareFactor=${fmtBig(shareDecFactor)} eer=${fmtBig(expectedExchangeRate)} ` +
      `(snapshotValue=${snapResult.strategyValueBase !== null ? fmtBig(snapResult.strategyValueBase) : 'null'} investedBaseTracked=${fmtBig(investedBaseTracked)} snapshotFresh=${snapResult.snapshotFresh} for audit)`
    )

    // --------------------------------------------------------------------------
    // Persist to entity (single source of truth)
    // --------------------------------------------------------------------------
    eer.totalSharesTracked = totalSharesTracked
    eer.idleBaseTracked = idleBaseTracked
    eer.investedBaseTracked = investedBaseTracked
    eer.expectedBorrowedPrincipalBaseRaw = borrowedPrincipalBaseTracked
    
    // Compute new borrowedBase (includes commitment fee as borrower liability)
    const newBorrowedBase = computeLocalBorrowedBase(borrowedPrincipalBaseTracked, accruedBorrowInterestBase, accruedCommitmentFeeBase)
    const oldBorrowedBase = borrowedPrincipalBaseTracked + accruedBorrowInterestBase // Old definition (without commitment fee)
    eer.expectedBorrowedBaseRaw = newBorrowedBase

    // Log comparison for debugging
    if (accruedCommitmentFeeBase > 0n) {
      ctx.log.info(
        `[EER BORROWED BASE CHANGE] vault=${vault.address} ` +
        `oldBorrowedBase=${fmtBig(oldBorrowedBase)} (principal=${fmtBig(borrowedPrincipalBaseTracked)} + interest=${fmtBig(accruedBorrowInterestBase)}) ` +
        `newBorrowedBase=${fmtBig(newBorrowedBase)} (principal + interest + commitFee=${fmtBig(accruedCommitmentFeeBase)}) ` +
        `delta=+${fmtBig(accruedCommitmentFeeBase)}`
      )
    }

    // --------------------------------------------------------------------------
    // SIMPLE INTEREST PERSISTENCE: Persist BASE values (compounded only at events)
    // for accrual fields, so the next window recomputes simple interest from the
    // same base. Display values (EER, netAssets) use the full computed values above.
    // --------------------------------------------------------------------------
    eer.accruedCommitmentFeeBase = baseAccruedCommitFee
    eer.accruedBorrowInterestBase = baseAccruedBorrowInterest

    // Persist BASE MTD counters (compounded only at events)
    // Projections use display values (computed above) which is correct for user-facing data
    eer.commitmentFeeAccruedMtdBaseRaw = baseMtdCommitFee
    eer.commitmentFeeMtdMonthStartTs = mtdMonthStartTs
    eer.commitmentFeeProjectedMonthEndBaseRaw = commitFeeProjectedMonthEndBase

    eer.borrowInterestAccruedMtdBaseRaw = baseMtdBorrowInterest
    eer.borrowInterestMtdMonthStartTs = mtdMonthStartTs
    eer.borrowInterestProjectedMonthEndBaseRaw = borrowInterestProjectedMonthEndBase

    // Persist current fee rates (use final tier from end of window)
    eer.commitmentFeeRateBps = finalCommitFeeRateBps
    eer.borrowRateBps = borrowRateBps

    // SIMPLE INTEREST: Persist lastAccrualTs as the last EVENT timestamp (not window boundary).
    // This ensures subsequent windows without events recompute simple interest from the same
    // base over an ever-growing time range, matching Excel's single-segment accrual behavior.
    ctx.log.info(
      `[EER PERSIST TIMESTAMPS] vault=${vault.address} BEFORE: expectedLastAccrualTs=${eer.expectedLastAccrualTs} ` +
      `cutoffTs=${cutoffTs} windowEndTs=${windowEndTs} hourTs=${hourTs} nowSec=${nowSec} ` +
      `baseLastAccrualTs=${baseLastAccrualTs} ` +
      `SETTING expectedLastAccrualTs=${baseLastAccrualTs} expectedLastUpdateTs=${cutoffTs}`
    )
    eer.expectedLastAccrualTs = baseLastAccrualTs // SIMPLE INTEREST: last event timestamp
    eer.expectedLastUpdateTs = cutoffTs // When we last processed (for time window gate)
    eer.lastAccrualBlock = BigInt(blockHeight)

    // Persist strategy yield tracking (prevents yield loss across updates)
    eer.strategyYieldBase = strategyYieldBase
    eer.lastSnapshotTsUsed = newLastSnapshotTsUsed

    // Persist BASE remainder numerators (from event processing only, not final segment)
    eer.commitFeeRemainderNumerator = baseCommitFeeRemainder
    eer.borrowInterestRemainderNumerator = baseBorrowInterestRemainder

    // Capture after value for snapshot debugging
    const lastAccrualTs_after = baseLastAccrualTs

    // Circuit breaker: ensure calculations don't exceed block 41015527
    const MAX_ALLOWED_BLOCK = 41015527000n
    if (eer.lastAccrualBlock > MAX_ALLOWED_BLOCK) {
      const errorMsg = `[EER CIRCUIT BREAKER] vault=${vault.address} lastAccrualBlock=${eer.lastAccrualBlock.toString()} exceeds MAX_ALLOWED_BLOCK=${MAX_ALLOWED_BLOCK.toString()}. Calculation stopped to ensure data integrity.`
      ctx.log.error(errorMsg)
      throw new Error(errorMsg)
    }

    // Keep these aligned (your dump shows these exist + are expected)
    eer.expectedAssetsBaseRaw = clamp0(netAssets)
    eer.netAssetsTrackedBaseRaw = clamp0(netAssets)
    eer.expectedExchangeRateBaseRaw = expectedExchangeRate

    expectedExchangeRates.set(eer.id, eer)

    // Compute borrowed concepts for snapshot (Excel reproduction)
    const borrowedForTier = borrowedPrincipalBaseTracked + accruedBorrowInterestBase // NO commitment fee
    const borrowedReported = computeLocalBorrowedBase(borrowedPrincipalBaseTracked, accruedBorrowInterestBase, accruedCommitmentFeeBase) // includes commitment fee
    
    // CRITICAL: Compute final tier values (at END of window after all events)
    // This matches Excel behavior where tier is recomputed after each event
    // For snapshot, we use the final tier (computed in final segment above)
    const totalForTierFinal = idleBaseTracked + effectiveStrategyValueBase + borrowedForTier
    let utilForTierBpsFinal = 0n
    if (totalForTierFinal > 0n) {
      utilForTierBpsFinal = (borrowedForTier * BPS_DENOMINATOR) / totalForTierFinal
    }
    // finalCommitFeeRateBps was computed above in the final accrual segment
    
    // Compute utilization for REPORTING only (at END of window) - this does NOT affect tier selection
    const totalReported = idleBaseTracked + effectiveStrategyValueBase + borrowedReported
    let utilReportedBpsEnd = 0n
    if (totalReported > 0n) {
      utilReportedBpsEnd = (borrowedReported * BPS_DENOMINATOR) / totalReported
    }
    
    // Compute totalAssetsBase for debugging (idle + invested + borrowedPrincipal)
    const totalAssetsBase = idleBaseTracked + effectiveStrategyValueBase + borrowedPrincipalBaseTracked

    // Capture batch metadata from ctx.blocks for debugging convergence
    const batchFirstBlock = ctx.blocks.length > 0 ? ctx.blocks[0].header.height : blockHeight
    const batchLastBlock = ctx.blocks.length > 0 ? ctx.blocks[ctx.blocks.length - 1].header.height : blockHeight
    const batchCount = ctx.blocks.length

    // Create snapshot on each EER calculation - includes ALL fields needed to reconstruct Excel row
    // Note: Snapshot is returned (not saved) - persistence handled by caller
    const snapshotId = `${vault.id}-${cutoffTs}-${blockHeight}`
    const snapshot = new ExpectedExchangeRateSnapshot({
      id: snapshotId,
      vault: vault,
      network: ctx.syncedNetwork,
      vaultAddress: vault.address.toLowerCase(),
      blockHeight: BigInt(blockHeight),
      blockTimestampMs: BigInt(blockTimestamp),
      nowSec: cutoffTs,
      updateTs: cutoffTs,
      block: BigInt(blockHeight), // alias of blockHeight
      blockTimestamp: cutoffTs, // alias of nowSec (seconds)
      expectedLastAccrualTs: eer.expectedLastAccrualTs,
      expectedLastUpdateTs: eer.expectedLastUpdateTs,
      expectedAssetsBaseRaw: eer.expectedAssetsBaseRaw,
      expectedBorrowedBaseRaw: borrowedReported, // principal + interest + commitmentFee (for backward compat)
      expectedBorrowedPrincipalBaseRaw: borrowedPrincipalBaseTracked,
      expectedExchangeRateBaseRaw: expectedExchangeRate,
      commitmentFeeAccruedMtdBaseRaw: eer.commitmentFeeAccruedMtdBaseRaw,
      commitmentFeeProjectedMonthEndBaseRaw: eer.commitmentFeeProjectedMonthEndBaseRaw,
      commitmentFeeMtdMonthStartTs: eer.commitmentFeeMtdMonthStartTs,
      borrowInterestAccruedMtdBaseRaw: eer.borrowInterestAccruedMtdBaseRaw,
      borrowInterestProjectedMonthEndBaseRaw: eer.borrowInterestProjectedMonthEndBaseRaw,
      borrowInterestMtdMonthStartTs: eer.borrowInterestMtdMonthStartTs,
      expectedRepaymentPendingBaseRaw: eer.expectedRepaymentPendingBaseRaw,
      expectedRepaymentCreditBaseRaw: eer.expectedRepaymentCreditBaseRaw,
      borrowRateBps: eer.borrowRateBps,
      commitmentFeeRateBps: finalCommitFeeRateBps, // Final tier from end of window (after all events)
      totalSharesTracked: totalSharesTracked,
      totalSharesSource: eer.totalSharesSource,
      netAssetsTrackedBaseRaw: clamp0(netAssets),
      idleBaseTracked: idleBaseTracked,
      investedBaseTracked: effectiveStrategyValueBase, // Use effective strategy value
      accruedCommitmentFeeBase: accruedCommitmentFeeBase,
      accruedBorrowInterestBase: accruedBorrowInterestBase,
      lastAccrualBlock: eer.lastAccrualBlock,
      utilizationBps: utilReportedBpsEnd, // backward compat - reporting utilization at END of window
      // Bases (explicitly named for Excel reproduction)
      idleBase: idleBaseTracked,
      investedBase: investedBaseTracked, // principal invested (for debugging)
      effectiveStrategyValueBase: effectiveStrategyValueBase, // current diverted value (principal + returns)
      borrowedPrincipalBase: borrowedPrincipalBaseTracked,
      // Derived (for Excel reproduction)
      borrowedForTier: borrowedForTier,
      borrowedReported: borrowedReported,
      utilForTierBps: utilForTierBpsFinal, // Final utilization from END of window (after all events)
      utilReportedBps: utilReportedBpsEnd, // reporting utilization at END of window (does NOT affect tier)
      netAssetsBase: clamp0(netAssets),
      eer: expectedExchangeRate,
      // Debugging fields (for Excel comparison and regression testing)
      totalAssetsBase: totalAssetsBase,
      dtSeconds: finalDtSec, // time delta for final accrual segment (lastAccrualTs -> windowEndTs)
      commitmentFeeAccruedDeltaBase: commitFeeAccruedThisHour, // delta accrued in this update window
      borrowInterestAccruedDeltaBase: borrowInterestAccruedThisHour, // delta accrued in this update window
      // Tier fields (for Excel comparison - now using dynamic tier)
      utilForTierBpsStart: 0n, // Deprecated: tier is now recomputed per segment (no longer frozen)
      commitFeeRateBpsStart: 0n, // Deprecated: tier is now recomputed per segment (no longer frozen)
      // Batch metadata fields (for debugging convergence)
      batchFirstBlock: BigInt(batchFirstBlock),
      batchLastBlock: BigInt(batchLastBlock),
      batchCount: batchCount,
      hourTs: hourTs, // hour boundary timestamp (floorToHour(cutoffTs))
      lastAccrualTsBefore: lastAccrualTs_before, // lastAccrualTs before update
      lastAccrualTsAfter: lastAccrualTs_after, // lastAccrualTs after update
      utilBpsEnd: utilReportedBpsEnd, // utilization at end (alias of utilReportedBps for clarity)
    })
    snapshots.set(snapshotId, snapshot)

    // Single comprehensive log line per snapshot with all required fields
    ctx.log.info(
      `[EER SNAPSHOT] vault=${vault.address} block=${blockHeight} blockTimestamp=${cutoffTs} ` +
      `expectedLastAccrualTs=${eer.expectedLastAccrualTs} ` +
      `totalSharesTracked=${totalSharesTracked.toString()} ` +
      `netAssetsTracked=${clamp0(netAssets).toString()} ` +
      `idleBase=${idleBaseTracked.toString()} ` +
      `investedBase=${investedBaseTracked.toString()} ` +
      `effectiveStrategyValueBase=${effectiveStrategyValueBase.toString()} ` +
      `borrowedPrincipalBase=${borrowedPrincipalBaseTracked.toString()} ` +
      `accruedBorrowInterestBase=${accruedBorrowInterestBase.toString()} ` +
      `accruedCommitmentFeeBase=${accruedCommitmentFeeBase.toString()} ` +
      `borrowedForTier=${borrowedForTier.toString()} ` +
      `borrowedReported=${borrowedReported.toString()} ` +
      `utilForTierBps_final=${utilForTierBpsFinal.toString()} ` +
      `commitFeeRateBps_final=${finalCommitFeeRateBps.toString()} ` +
      `utilReportedBps_end=${utilReportedBpsEnd.toString()} ` +
      `totalAssetsBase=${totalAssetsBase.toString()} ` +
      `commitmentFeeRateBps=${finalCommitFeeRateBps.toString()} ` +
      `dtSeconds=${finalDtSec} ` +
      `commitmentFeeAccruedDeltaBase=${commitFeeAccruedThisHour.toString()} ` +
      `borrowInterestAccruedDeltaBase=${borrowInterestAccruedThisHour.toString()} ` +
      `eer=${expectedExchangeRate.toString()}`
    )
  }

  return { portVaults, expectedExchangeRates, snapshots }
}

export const eerService = {
  updateExpectedExchangeRateForVaults,
  recordEnterEvent,
  recordAtomicRequestFulfilledEvent,
  recordBorrowerTransferEvent,
  recordFundsDivertedEvent,
  recordFundsRevertedEvent,
}


