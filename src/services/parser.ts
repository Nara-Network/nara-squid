
import { ProcessorContext, Log } from '../common/processor';

import { Config } from '../common/types';
import { convertToBaseTokenAmount, isTestnet, readContract, normalizeDecimals, clampToZero, getTokenDecimalsCached } from '../helpers/common';
import { getEERConfigForVault, isEERDebugEnabled } from '../helpers/eer';
import { PortVault, User, PortDeposit, PortWithdrawalRequest, PortWithdrawalRequestStatus, PortVaultStatus, PortVaultStatusUpdate, PortNavUpdate, PortGlobalStats, PortRequestFulfilled, PortVaultActivity, PortVaultAction, PortVaultTransactionHistory, PortVaultTxAction, PortVaultAPY, PortVaultType, FundsDiverted, FundsReverted, StrategyKind, StrategyYieldSnapshot, StrategyYieldState, ManagerWithdraw, ManagerDeposit, PortVaultApyChart, NaraRedemption, NaraRedemptionActivity, NaraRedemptionAction, NaraRedemptionStatus, TotalRequestedAmount } from '../model';
import * as BoringVaultAbi from '../abi/BoringVault';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import * as AtomicQueueAbi from '../abi/AtomicQueue';
import * as TellerAbi from '../abi/TellerWithMultiAssetSupport';
import * as AaveV3PoolAbi from '../abi/AaveV3Pool';
import * as CompoundUSDCAbi from '../abi/CompoundUSDC';
import * as ERC20Abi from '../abi/ERC20';
import * as NaraUSD from '../abi/NaraUSD';
import { userService } from './user';
import { tokensService } from './tokens';
import { In, Not } from 'typeorm';
import { SKIP_ACTIVITY_TX_HASHES } from '../constants';
import { throwError } from '../common/utils/error';
import { portService } from './port';
import { toSec } from '../common/utils/time';
import { eerService } from './eer';

function createEmptyUser(userId: string, address: string, network: ProcessorContext['syncedNetwork']): User {
  return new User({
    id: userId,
    address: address.toLowerCase(),
    isTestnet: isTestnet(network),
    portWithdrawalRequests: [],
    portDeposits: [],
    naraRedemptions: [],
  });
}

async function getPendingNaraRedemption(
  ctx: ProcessorContext,
  userId: string,
  naraRedemptions: Map<string, NaraRedemption>,
): Promise<NaraRedemption | undefined> {
  const inMemoryPending = Array.from(naraRedemptions.values()).find(
    (redemption) => redemption.user.id === userId && redemption.status === NaraRedemptionStatus.REQUESTED
  );

  if (inMemoryPending) {
    return inMemoryPending;
  }

  return ctx.store.findOne(NaraRedemption, {
    where: {
      id: Not(In(Array.from(naraRedemptions.keys()))),
      user: { id: userId },
      status: NaraRedemptionStatus.REQUESTED,
    },
    relations: { user: true },
  });
}

function getTotalRequestedAmountId(collateralAddress: string): string {
  return collateralAddress.toLowerCase();
}

async function getTotalRequestedAmount(
  ctx: ProcessorContext,
  collateralAddress: string,
  totalRequestedAmounts: Map<string, TotalRequestedAmount>,
): Promise<TotalRequestedAmount> {
  const normalizedCollateralAddress = collateralAddress.toLowerCase();
  const totalRequestedAmountId = getTotalRequestedAmountId(normalizedCollateralAddress);
  const inMemory = totalRequestedAmounts.get(totalRequestedAmountId);

  if (inMemory) {
    return inMemory;
  }

  const persisted = await ctx.store.findOne(TotalRequestedAmount, {
    where: { id: totalRequestedAmountId },
  });

  if (persisted) {
    totalRequestedAmounts.set(persisted.id, persisted);
    return persisted;
  }

  const totalRequestedAmount = new TotalRequestedAmount({
    id: totalRequestedAmountId,
    collateralAddress: normalizedCollateralAddress,
    amount: 0n,
  });

  totalRequestedAmounts.set(totalRequestedAmount.id, totalRequestedAmount);
  return totalRequestedAmount;
}

async function applyTotalRequestedAmountDelta(
  ctx: ProcessorContext,
  totalRequestedAmounts: Map<string, TotalRequestedAmount>,
  collateralAddress: string,
  delta: bigint,
): Promise<Map<string, TotalRequestedAmount>> {
  if (delta === 0n) {
    return totalRequestedAmounts;
  }

  const totalRequestedAmount = await getTotalRequestedAmount(ctx, collateralAddress, totalRequestedAmounts);
  const nextAmount = totalRequestedAmount.amount + delta;

  if (nextAmount < 0n) {
    ctx.log.warn(
      `[NARA] TotalRequestedAmount underflow prevented for collateral=${collateralAddress.toLowerCase()} current=${totalRequestedAmount.amount.toString()} delta=${delta.toString()}`
    );
  }

  totalRequestedAmount.amount = clampToZero(nextAmount);
  totalRequestedAmounts.set(totalRequestedAmount.id, totalRequestedAmount);

  return totalRequestedAmounts;
}

async function parseNaraRedemptionActivity(
  ctx: ProcessorContext,
  log: Log,
  users: Map<string, User>,
  naraRedemptions: Map<string, NaraRedemption>,
  naraRedemptionActivities: Map<string, NaraRedemptionActivity>,
  totalRequestedAmounts: Map<string, TotalRequestedAmount>,
): Promise<{
  users: Map<string, User>,
  naraRedemptions: Map<string, NaraRedemption>,
  naraRedemptionActivities: Map<string, NaraRedemptionActivity>,
  totalRequestedAmounts: Map<string, TotalRequestedAmount>,
}> {
  let action: NaraRedemptionAction;
  let userAddress: string;
  let collateralAssetAddress: string;
  let naraUsdAmount: bigint;
  let collateralAmount: bigint | undefined;
  const timestamp = BigInt(log.block.timestamp);

  switch (log.topics[0]) {
    case NaraUSD.events.Redeem.topic: {
      const { beneficiary, collateralAsset, naraUsdAmount: redeemAmount, collateralAmount: redeemedCollateral } =
        NaraUSD.events.Redeem.decode(log);
      action = NaraRedemptionAction.INSTANT_REDEEM;
      userAddress = beneficiary.toLowerCase();
      collateralAssetAddress = collateralAsset.toLowerCase();
      naraUsdAmount = redeemAmount;
      collateralAmount = redeemedCollateral;
      break;
    }
    case NaraUSD.events.RedemptionRequested.topic: {
      const { user, naraUsdAmount: requestedAmount, collateralAsset } =
        NaraUSD.events.RedemptionRequested.decode(log);
      action = NaraRedemptionAction.REQUESTED;
      userAddress = user.toLowerCase();
      collateralAssetAddress = collateralAsset.toLowerCase();
      naraUsdAmount = requestedAmount;
      collateralAmount = undefined;
      break;
    }
    case NaraUSD.events.RedemptionCompleted.topic: {
      const { user, naraUsdAmount: completedAmount, collateralAsset, collateralAmount: completedCollateral } =
        NaraUSD.events.RedemptionCompleted.decode(log);
      action = NaraRedemptionAction.COMPLETED;
      userAddress = user.toLowerCase();
      collateralAssetAddress = collateralAsset.toLowerCase();
      naraUsdAmount = completedAmount;
      collateralAmount = completedCollateral;
      break;
    }
    default:
      return { users, naraRedemptions, naraRedemptionActivities, totalRequestedAmounts };
  }
  const userId = userService.getUserId(userAddress, ctx.syncedNetwork);
  let user = users.get(userId) ?? await userService.getUserById(ctx, userId);

  if (!user) {
    user = createEmptyUser(userId, userAddress, ctx.syncedNetwork);
    users.set(userId, user);
  }

  let redemption: NaraRedemption;
  if (action === NaraRedemptionAction.INSTANT_REDEEM) {
    redemption = new NaraRedemption({
      id: `${log.transactionHash}-${log.logIndex}`,
      user,
      status: NaraRedemptionStatus.COMPLETED,
      naraUsdAmount,
      collateralAmount,
      collateralAssetAddress,
      requestedAt: timestamp,
      completedAt: timestamp,
      updatedAt: timestamp,
      activities: [],
    });
  } else if (action === NaraRedemptionAction.REQUESTED) {
    const existingPendingRedemption = await getPendingNaraRedemption(ctx, userId, naraRedemptions);

    if (existingPendingRedemption) {
      totalRequestedAmounts = await applyTotalRequestedAmountDelta(
        ctx,
        totalRequestedAmounts,
        existingPendingRedemption.collateralAssetAddress,
        -existingPendingRedemption.naraUsdAmount,
      );

      existingPendingRedemption.status = NaraRedemptionStatus.REQUESTED;
      existingPendingRedemption.naraUsdAmount = naraUsdAmount;
      existingPendingRedemption.collateralAssetAddress = collateralAssetAddress;
      existingPendingRedemption.collateralAmount = undefined;
      existingPendingRedemption.updatedAt = timestamp;
      redemption = existingPendingRedemption;
    } else {
      redemption = new NaraRedemption({
        id: `${userId}-${log.transactionHash}-${log.logIndex}`,
        user,
        status: NaraRedemptionStatus.REQUESTED,
        naraUsdAmount,
        collateralAmount: undefined,
        collateralAssetAddress,
        requestedAt: timestamp,
        completedAt: undefined,
        updatedAt: timestamp,
        activities: [],
      });
    }

    totalRequestedAmounts = await applyTotalRequestedAmountDelta(
      ctx,
      totalRequestedAmounts,
      collateralAssetAddress,
      naraUsdAmount,
    );
  } else {
    const existingPendingRedemption = await getPendingNaraRedemption(ctx, userId, naraRedemptions);

    if (!existingPendingRedemption) {
      throwError(`Pending Nara redemption not found - parseNaraRedemptionActivity failed.`, log.transactionHash);
    }

    totalRequestedAmounts = await applyTotalRequestedAmountDelta(
      ctx,
      totalRequestedAmounts,
      existingPendingRedemption.collateralAssetAddress,
      -existingPendingRedemption.naraUsdAmount,
    );

    existingPendingRedemption.status = NaraRedemptionStatus.COMPLETED;
    existingPendingRedemption.naraUsdAmount = naraUsdAmount;
    existingPendingRedemption.collateralAssetAddress = collateralAssetAddress;
    existingPendingRedemption.collateralAmount = collateralAmount;
    existingPendingRedemption.completedAt = timestamp;
    existingPendingRedemption.updatedAt = timestamp;
    redemption = existingPendingRedemption;
  }

  naraRedemptions.set(redemption.id, redemption);

  const activity = new NaraRedemptionActivity({
    id: `${log.transactionHash}-${log.logIndex}`,
    redemption,
    action,
    naraUsdAmount,
    collateralAmount,
    collateralAssetAddress,
    timestamp,
    txHash: log.transactionHash,
    block: BigInt(log.block.height),
  });

  naraRedemptionActivities.set(activity.id, activity);

  return { users, naraRedemptions, naraRedemptionActivities, totalRequestedAmounts };
}

async function parseVaultEnter(ctx: ProcessorContext, log: Log, config: Config, portDeposits: Map<string, PortDeposit>, users: Map<string, User>, portVaults: Map<string, PortVault>, portGlobalStats: PortGlobalStats, portVaultTransactionHistories: Map<string, PortVaultTransactionHistory>): Promise<{ portDeposits: Map<string, PortDeposit>, users: Map<string, User>, portVaults: Map<string, PortVault>, portGlobalStats: PortGlobalStats, portVaultTransactionHistories: Map<string, PortVaultTransactionHistory> }> {
  const { from, asset, amount, shares } = BoringVaultAbi.events.Enter.decode(log);
  const userId = userService.getUserId(from, ctx.syncedNetwork);

  const portVault = portVaults.get(log.address) ?? await portService.getPortVaultByAddress(ctx, log.address);

  if (!portVault) {
    throwError(`Port vault not found - parseVaultEnter failed.`, log.transactionHash);
  }

  // Log Enter event
  ctx.log.info(
    `[ENTER EVENT] vault=${portVault.address} ` +
    `from=${from.toLowerCase()} ` +
    `asset=${asset.toLowerCase()} ` +
    `amount=${amount.toString()} ` +
    `shares=${shares.toString()} ` +
    `txHash=${log.transactionHash} ` +
    `block=${log.block.height}`
  )

  const token = await tokensService.getTokenByAddress(ctx, asset);

  if (!token) {
    throwError(`Token not found - parseVaultEnter failed.`, log.transactionHash);
  }

  const portDepositId = `${from}-${log.address}-${log.transactionHash}`;

  let user = users.get(userId) ?? await userService.getUserById(ctx, userId);

  if (!user) {
    user = createEmptyUser(userId, from, ctx.syncedNetwork);
    users.set(userId, user);
  }
  const portDeposit = new PortDeposit({
    id: portDepositId,
    vault: portVault,
    user,
    asset: token,
    amount,
    shares: BigInt(shares),
    txHash: log.transactionHash,
    timestamp: BigInt(log.block.timestamp),
    block: BigInt(log.block.height),
  });

  portDeposits.set(portDepositId, portDeposit);

  if (!user.portDeposits?.length) {
    portGlobalStats.activeUsers = portGlobalStats.activeUsers + BigInt(1);
  }

  const portVaultTransactionHistory = new PortVaultTransactionHistory({
    id: `${portDepositId}`,
    vault: portVault,
    user,
    asset: token.address,
    amount,
    action: PortVaultTxAction.DEPOSIT,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultTransactionHistories.set(portVaultTransactionHistory.id, portVaultTransactionHistory);

  portVaults.set(portVault.address.toLowerCase(), portVault);

  // ============================================================================
  // EER: ONE CALL ONLY - record event to inbox
  // ============================================================================
  const ts = toSec(log.block.timestamp);
  ctx.log.info(
    `[EER PARSER] kind=ENTER vault=${portVault.address} vaultId=${portVault.id} ` +
    `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
    `asset=${asset.toLowerCase()} amountRaw=${amount.toString()} sharesRaw=${shares.toString()}`
  );
  await eerService.recordEnterEvent(ctx, portVault, log);

  return { portDeposits, users, portVaults, portGlobalStats, portVaultTransactionHistories };
}

async function parseAtomicRequestUpdated(ctx: ProcessorContext, log: Log, portWithdrawalRequests: Map<string, PortWithdrawalRequest>, users: Map<string, User>, portVaults: Map<string, PortVault>, portVaultTransactionHistories: Map<string, PortVaultTransactionHistory>): Promise<{ portWithdrawalRequests: Map<string, PortWithdrawalRequest>, users: Map<string, User>, portVaults: Map<string, PortVault>, portVaultTransactionHistories: Map<string, PortVaultTransactionHistory> }> {
  const { user: from, wantToken: asset, offerToken: vaultAddress, amount: offerAmount, deadline: deadlineSec, timestamp: timestampSec, minPrice } = AtomicQueueAbi.events.AtomicRequestUpdated.decode(log);
  const timestamp = BigInt(timestampSec) * BigInt(1000);
  const deadline = BigInt(deadlineSec) * BigInt(1000);

  const portVault = portVaults.get(vaultAddress) ?? await portService.getPortVaultByAddress(ctx, vaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseAtomicRequestUpdated failed.`, log.transactionHash);
  }

  const price = portVault.currentNav;
  const priceInBaseToken = convertToBaseTokenAmount(price, BigInt(portVault.decimals), BigInt(18));

  const userId = userService.getUserId(from, ctx.syncedNetwork);

  let user = users.get(userId) ?? await userService.getUserById(ctx, userId);

  if (!user) {
    user = createEmptyUser(userId, from, ctx.syncedNetwork);
    users.set(userId, user);
  }

  const wantToken = await tokensService.getTokenByAddress(ctx, asset);
  // Offert amount is in base decimals already, 
  const wantAmountInBaseToken = offerAmount * BigInt(priceInBaseToken) / BigInt(10 ** Number(portVault.decimals));
  const portWithdrawalRequestId = `${from}-${vaultAddress}-${log.transactionHash}`;

  if (!wantToken) {
    throwError(`Token for withdrawal request not found - parseAtomicRequestUpdated failed.`, log.transactionHash);
  }

  const existingPortWithdrawalRequest = Array.from(portWithdrawalRequests.values()).find(r => r.vault.address == vaultAddress && r.user.id == userId && r.status == PortWithdrawalRequestStatus.PENDING) ?? await ctx.store.findOne(PortWithdrawalRequest, { where: { id: Not(In(Array.from(portWithdrawalRequests.keys()))), vault: { address: vaultAddress, network: ctx.syncedNetwork }, user: { id: userId }, status: PortWithdrawalRequestStatus.PENDING }, relations: { vault: true, user: true } });

  if (!existingPortWithdrawalRequest) {
    const portWithdrawalRequest = new PortWithdrawalRequest({
      id: portWithdrawalRequestId,
      vault: portVault,
      user,
      wantToken,
      wantAmount: wantAmountInBaseToken,
      offerAmount,
      txHash: log.transactionHash,
      timestamp: BigInt(timestamp),
      deadline: BigInt(deadline),
      block: BigInt(log.block.height),
      status: PortWithdrawalRequestStatus.PENDING,
    });
    portWithdrawalRequests.set(portWithdrawalRequestId, portWithdrawalRequest);

    portVault.totalPendingWithdrawalRequests = portVault.totalPendingWithdrawalRequests + BigInt(1);
    portVault.totalWithdrawalRequestsInBaseToken = portVault.totalWithdrawalRequestsInBaseToken + offerAmount;
    portVaults.set(vaultAddress, portVault);

    const portVaultTransactionHistory = new PortVaultTransactionHistory({
      id: `${portWithdrawalRequestId}`,
      vault: portVault,
      user,
      asset: vaultAddress,
      amount: offerAmount,
      action: PortVaultTxAction.WITHDRAWAL_REQUEST_CREATED,
      timestamp: BigInt(timestamp),
      txHash: log.transactionHash,
    });
    portVaultTransactionHistories.set(portVaultTransactionHistory.id, portVaultTransactionHistory);
  } else {
    const previousOfferAmount = existingPortWithdrawalRequest.offerAmount;

    existingPortWithdrawalRequest.deadline = BigInt(deadline);
    existingPortWithdrawalRequest.timestamp = BigInt(timestamp);
    existingPortWithdrawalRequest.offerAmount = offerAmount;
    existingPortWithdrawalRequest.txHash = log.transactionHash;
    existingPortWithdrawalRequest.wantToken = wantToken;
    existingPortWithdrawalRequest.wantAmount = wantAmountInBaseToken;
    portWithdrawalRequests.set(existingPortWithdrawalRequest.id, existingPortWithdrawalRequest);

    portVault.totalWithdrawalRequestsInBaseToken = portVault.totalWithdrawalRequestsInBaseToken - previousOfferAmount + offerAmount;
    portVaults.set(vaultAddress, portVault);

    const existingPortVaultTransactionHistory = portVaultTransactionHistories.get(`${existingPortWithdrawalRequest.id}`) ?? await ctx.store.findOne(PortVaultTransactionHistory, { where: { id: `${existingPortWithdrawalRequest.id}`, vault: { network: ctx.syncedNetwork } } });

    if (existingPortVaultTransactionHistory) {
      existingPortVaultTransactionHistory.amount = offerAmount;
      existingPortVaultTransactionHistory.timestamp = BigInt(timestamp);
      existingPortVaultTransactionHistory.txHash = log.transactionHash;
      existingPortVaultTransactionHistory.asset = vaultAddress;
      portVaultTransactionHistories.set(existingPortVaultTransactionHistory.id, existingPortVaultTransactionHistory);
    }
  }

  return { portWithdrawalRequests, users, portVaults, portVaultTransactionHistories };
}

async function parseVaultStatusUpdate(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, status: PortVaultStatus, portVaultStatusUpdates: Map<string, PortVaultStatusUpdate>, portVaultActivities: Map<string, PortVaultActivity>): Promise<{ portVaults: Map<string, PortVault>, portVaultStatusUpdates: Map<string, PortVaultStatusUpdate>, portVaultActivities: Map<string, PortVaultActivity> }> {
  const tellerAddress = log.address;

  const configuredPortVaults = config.Port?.Vaults;

  if (!configuredPortVaults?.length) {
    throwError(`Configured port vaults not found - parseVaultStatusUpdate failed.`, log.transactionHash);
  }

  const portVaultAddress = configuredPortVaults.find((vault) => vault.Teller.toLowerCase() == tellerAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseVaultStatusUpdate failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseVaultStatusUpdate failed.`, log.transactionHash);
  }

  if (portVault.status === status) {
    return { portVaults, portVaultStatusUpdates, portVaultActivities };
  }

  portVault.status = status;
  portVault.totalActivity = portVault.totalActivity + BigInt(1);
  portVaults.set(portVaultAddress.toLowerCase(), portVault);

  const newPortVaultStatusUpdate = new PortVaultStatusUpdate({
    id: `${portVaultAddress}-${status}-${log.transactionHash}`,
    vault: portVault,
    newStatus: status,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
    block: BigInt(log.block.height),
  });

  portVaultStatusUpdates.set(newPortVaultStatusUpdate.id, newPortVaultStatusUpdate);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.VAULT_STATUS_UPDATE}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.VAULT_STATUS_UPDATE,
    details: status,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultStatusUpdates, portVaultActivities };
}

async function parseNavUpdate(ctx: ProcessorContext, log: Log, config: Config, portNavUpdates: Map<string, PortNavUpdate>, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, portVaultAPYs: Map<string, PortVaultAPY>, portVaultApyCharts: Map<string, PortVaultApyChart>): Promise<{ portNavUpdates: Map<string, PortNavUpdate>, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, portVaultAPYs: Map<string, PortVaultAPY>, portVaultApyCharts: Map<string, PortVaultApyChart> }> {
  const accountantAddress = log.address;

  if (SKIP_ACTIVITY_TX_HASHES.includes(log.transactionHash)) {
    return { portNavUpdates, portVaults, portVaultActivities, portVaultAPYs, portVaultApyCharts };
  }

  const { newRate, oldRate } = AccountantAbi.events.ExchangeRateUpdated.decode(log);

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Accountant.toLowerCase() == accountantAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseNavUpdate failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseNavUpdate failed.`, log.transactionHash);
  }

  const isSynced = ctx.isHead && ctx.blocks.length === 1;

  portVault.currentNav = BigInt(newRate);
  portVault.totalActivity = portVault.totalActivity + BigInt(1);

  const newPortNavUpdate = new PortNavUpdate({
    id: `${portVaultAddress}-${newRate}-${log.transactionHash}`,
    vault: portVault,
    newRate: BigInt(newRate),
    oldRate: BigInt(oldRate),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
    block: BigInt(log.block.height),
  });
  portNavUpdates.set(newPortNavUpdate.id, newPortNavUpdate);


  if (portVault.type === PortVaultType.STANDARD) {
    const startApyCalculationTimestamp = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == portVault.address.toLowerCase())?.StartApyCalculationTimestamp;
    const apyAllTime = await portService.calculateAPRFromRate(ctx, newPortNavUpdate, portVault, startApyCalculationTimestamp);
    portVault.apy = apyAllTime;

    const currentTimestamp = BigInt(log.block.timestamp);
    const currentBlock = BigInt(log.block.height);
    const apyId = `${portVault.id}-${currentTimestamp}-${log.transactionHash}`;

    const portVaultAPY = new PortVaultAPY({
      id: apyId,
      vault: portVault,
      apy: apyAllTime,
      timestamp: currentTimestamp,
      block: currentBlock,
    });
    portVaultAPYs.set(apyId, portVaultAPY);

    const currentExchangeRate = BigInt(newRate);
    const currentTimestampNum = Number(log.block.timestamp);
    
    await portService.getOrCreateDailyChartEntry(
      ctx,
      portVault,
      currentExchangeRate,
      currentTimestampNum,
      currentBlock,
      portVaultApyCharts,
      startApyCalculationTimestamp,
      portNavUpdates
    );
  }

  // Calculate average APY for 7, 30, and 365 days when synced
  if (isSynced) {
    const avg7dApy = await portService.calculateAverageAPYForPeriod(ctx, portVault.address, 7, Number(log.block.timestamp), portVaultAPYs);
    const avg30dApy = await portService.calculateAverageAPYForPeriod(ctx, portVault.address, 30, Number(log.block.timestamp), portVaultAPYs);
    const avg1yApy = await portService.calculateAverageAPYForPeriod(ctx, portVault.address, 365, Number(log.block.timestamp), portVaultAPYs);
    portVault.avg7dApy = avg7dApy;
    portVault.avg30dApy = avg30dApy;
    portVault.avg1yApy = avg1yApy;
  }

  portVaults.set(portVaultAddress.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.NAV_UPDATE}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.NAV_UPDATE,
    details: `NAV updated from $${Number((Number(oldRate) / (10 ** Number(18))).toPrecision(6))} to $${Number((Number(newRate) / (10 ** Number(18))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portNavUpdates, portVaults, portVaultActivities, portVaultAPYs, portVaultApyCharts };
}

async function parseAssetAdded(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>): Promise<{ portVaults: Map<string, PortVault> }> {
  const tellerAddress = log.address;
  const { asset } = TellerAbi.events.AssetAdded.decode(log);

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Teller.toLowerCase() == tellerAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseAssetAdded failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseAssetAdded failed.`, log.transactionHash);
  }

  if (!portVault.assets.includes(asset)) {
    portVault.assets.push(asset);
    portVaults.set(portVaultAddress.toLowerCase(), portVault);
  }

  return { portVaults };
}

async function parseAssetRemoved(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>): Promise<{ portVaults: Map<string, PortVault> }> {
  const tellerAddress = log.address;
  const { asset: assetAddressToRemove } = TellerAbi.events.AssetRemoved.decode(log);

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Teller.toLowerCase() == tellerAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseAssetRemoved failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseAssetRemoved failed.`, log.transactionHash);
  }

  portVault.assets = portVault.assets.filter((asset) => asset !== assetAddressToRemove);
  portVaults.set(portVaultAddress.toLowerCase(), portVault);

  return { portVaults };
}

async function parseAtomicRequestFulfilled(
  ctx: ProcessorContext,
  log: Log,
  config: Config,
  portRequestFulfilleds: Map<string, PortRequestFulfilled>,
  portWithdrawalRequests: Map<string, PortWithdrawalRequest>,
  users: Map<string, User>,
  portVaults: Map<string, PortVault>,
  portVaultTransactionHistories: Map<string, PortVaultTransactionHistory>,
  portGlobalStats: PortGlobalStats
): Promise<{
  portRequestFulfilleds: Map<string, PortRequestFulfilled>,
  portWithdrawalRequests: Map<string, PortWithdrawalRequest>,
  users: Map<string, User>,
  portVaults: Map<string, PortVault>,
  portVaultTransactionHistories: Map<string, PortVaultTransactionHistory>,
  portGlobalStats: PortGlobalStats
}> {
  const {
    user: userAddress,
    wantToken: asset,
    offerToken: vaultAddress,
    offerAmountSpent,
    wantAmountReceived,
    timestamp: timestampSec,
  } = AtomicQueueAbi.events.AtomicRequestFulfilled.decode(log);

  const timestamp = BigInt(timestampSec) * BigInt(1000);

  const portVault = portVaults.get(vaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, vaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseAtomicRequestFulfilled failed.`, log.transactionHash);
  }

  const userId = userService.getUserId(userAddress, ctx.syncedNetwork);

  const existingPortWithdrawalRequest = Array.from(portWithdrawalRequests.values()).find(r => r.vault.address == vaultAddress && r.user.id == userId && r.status == PortWithdrawalRequestStatus.PENDING) ?? await ctx.store.findOne(PortWithdrawalRequest, { where: { id: Not(In(Array.from(portWithdrawalRequests.keys()))), vault: { address: vaultAddress, network: ctx.syncedNetwork }, user: { id: userId }, status: PortWithdrawalRequestStatus.PENDING }, relations: { vault: true, user: true } });

  if (!existingPortWithdrawalRequest) {
    throwError(`Port withdrawal request not found - parseAtomicRequestFulfilled failed.`, log.transactionHash);
  }

  const user = users.get(userId) ?? await userService.getUserById(ctx, userId);

  if (!user) {
    throwError(`User not found - parseAtomicRequestFulfilled failed.`, log.transactionHash);
  }

  const token = await tokensService.getTokenByAddress(ctx, asset);

  if (!token) {
    throwError(`Token not found - parseAtomicRequestFulfilled failed.`, log.transactionHash);
  }

  existingPortWithdrawalRequest.status = PortWithdrawalRequestStatus.COMPLETED;

  portWithdrawalRequests.set(existingPortWithdrawalRequest.id, existingPortWithdrawalRequest);

  const portRequestFulfilled = new PortRequestFulfilled({
    id: `${existingPortWithdrawalRequest.id}`,
    vault: portVault,
    user,
    offerAmountSpent: offerAmountSpent,
    wantToken: token,
    wantAmountReceived: wantAmountReceived,
    txHash: log.transactionHash,
    timestamp: BigInt(timestamp),
    block: BigInt(log.block.height),
  });

  portRequestFulfilleds.set(portRequestFulfilled.id, portRequestFulfilled);

  const portVaultTransactionHistory = new PortVaultTransactionHistory({
    id: `${portRequestFulfilled.id}-${PortVaultTxAction.WITHDRAWAL_REQUEST_PROCESSED}`,
    vault: portVault,
    user,
    asset: token.address,
    amount: wantAmountReceived,
    action: PortVaultTxAction.WITHDRAWAL_REQUEST_PROCESSED,
    timestamp: BigInt(timestamp),
    txHash: log.transactionHash,
  });

  portVault.totalPendingWithdrawalRequests = portVault.totalPendingWithdrawalRequests - BigInt(1);
  portVault.totalWithdrawalRequestsInBaseToken = portVault.totalWithdrawalRequestsInBaseToken - offerAmountSpent;
  portVaults.set(portVault.address.toLowerCase(), portVault);

  portVaultTransactionHistories.set(portVaultTransactionHistory.id, portVaultTransactionHistory);

  // ============================================================================
  // EER: ONE CALL ONLY - record event to inbox
  // ============================================================================
  const ts = toSec(log.block.timestamp);
  ctx.log.info(
    `[EER PARSER] kind=ATOMIC_REQUEST_FULFILLED vault=${portVault.address} vaultId=${portVault.id} ` +
    `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
    `offerToken=${vaultAddress.toLowerCase()} wantToken=${asset.toLowerCase()} ` +
    `offerAmountSpent=${offerAmountSpent.toString()} wantAmountReceived=${wantAmountReceived.toString()}`
  );
  await eerService.recordAtomicRequestFulfilledEvent(ctx, portVault, log, config);

  return { portRequestFulfilleds, portWithdrawalRequests, users, portVaults, portVaultTransactionHistories, portGlobalStats };
}

async function parseLendingRateUpdated(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, portVaultAPYs: Map<string, PortVaultAPY>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, portVaultAPYs: Map<string, PortVaultAPY> }> {
  const accountantAddress = log.address;

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Accountant.toLowerCase() == accountantAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseLendingRateUpdated failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseLendingRateUpdated failed.`, log.transactionHash);
  }

  const { newRate } = AccountantAbi.events.LendingRateUpdated.decode(log);

  portVault.totalActivity = portVault.totalActivity + BigInt(1);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.LENDING_RATE_UPDATED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.LENDING_RATE_UPDATED,
    details: `APR updated to ${Number((Number(newRate) / 100))}%`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  if (newRate === BigInt(0)) {
    portVault.type = PortVaultType.STANDARD;
  } else {
    portVault.type = PortVaultType.PAYFI;
    portVault.apy = newRate;

    const currentTimestamp = BigInt(log.block.timestamp);
    const currentBlock = BigInt(log.block.height);
    const apyId = `${portVault.id}-${currentTimestamp}-${log.transactionHash}`;

    const portVaultAPY = new PortVaultAPY({
      id: apyId,
      vault: portVault,
      apy: newRate,
      timestamp: currentTimestamp,
      block: currentBlock,
    });

    portVaultAPYs.set(apyId, portVaultAPY);
  }

  portVaults.set(portVault.address.toLowerCase(), portVault);

  return { portVaults, portVaultActivities, portVaultAPYs };
}

async function parseManagementFeeUpdated(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, isPayFi: boolean = false): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity> }> {
  const accountantAddress = log.address;

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Accountant.toLowerCase() == accountantAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseManagementFeeUpdated failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseManagementFeeUpdated failed.`, log.transactionHash);
  }

  const newFee = AccountantAbi.events.ManagementFeeRateUpdated.decode(log).newRate

  portVault.managementFee = BigInt(newFee);
  portVault.totalActivity = portVault.totalActivity + BigInt(1);
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.MANAGEMENT_FEE_UPDATED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.MANAGEMENT_FEE_UPDATED,
    details: `Management fee updated to ${Number((Number(newFee) / 100))}%`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities };
}

async function parseFeesClaimed(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, isPayFi: boolean = false): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity> }> {
  const accountantAddress = log.address;


  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Accountant.toLowerCase() == accountantAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseManagementFeeUpdated failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseManagementFeeUpdated failed.`, log.transactionHash);
  }

  const { amount } = AccountantAbi.events.FeesClaimed.decode(log);

  // Fees claimed reduce NAV/assets but do NOT burn shares
  // NAV updates via ExchangeRateUpdated will reflect the fee impact
  // EER recompute happens at time window intervals - no event-triggered recompute

  portVault.totalActivity = portVault.totalActivity + BigInt(1);
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FEES_CLAIMED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FEES_CLAIMED,
    details: `Fees claimed: $${Number((Number(amount) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities };
}

async function parseDepositCapUpdated(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity> }> {
  const tellerAddress = log.address;

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.Teller.toLowerCase() == tellerAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    throwError(`Port vault address not found - parseDepositCapUpdated failed.`, log.transactionHash);
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseDepositCapUpdated failed.`, log.transactionHash);
  }

  const { newCap, oldCap } = TellerAbi.events.DepositCapUpdated.decode(log);

  portVault.depositCap = newCap;
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.DEPOSIT_CAP_UPDATED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.DEPOSIT_CAP_UPDATED,
    details: `Deposit cap updated from $${Number((Number(oldCap) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))} to $${Number((Number(newCap) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities };
}

async function parseFundsDiverted(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsDiverted: Map<string, FundsDiverted>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsDiverted: Map<string, FundsDiverted> }> {
  const { amount, user: vaultAddress, reserve, onBehalfOf } = AaveV3PoolAbi.events.Supply.decode(log);

  // Track based on user (who initiated the supply from the vault)
  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == vaultAddress.toLowerCase())?.address;
  if (!portVaultAddress) {
    return { portVaults, portVaultActivities, fundsDiverted };
  }

  ctx.log.info(
    `[AAVE SUPPLY DEBUG] block=${log.block.height} txHash=${log.transactionHash} ` +
    `pool=${log.address.toLowerCase()} user=${vaultAddress.toLowerCase()} ` +
    `onBehalfOf=${onBehalfOf.toLowerCase()} reserve=${reserve.toLowerCase()} amount=${amount.toString()}`
  )

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseFundsDiverted failed.`, log.transactionHash);
  }

  // Normalize amount to base token decimals for EER tracking
  const reserveLower = reserve.toLowerCase();
  const baseTokenLower = portVault.baseToken.address.toLowerCase();
  const baseDec = Number(portVault.baseToken.decimals);
  let amountBase = BigInt(amount);
  
  // If reserve is not the base token, normalize decimals
  if (reserveLower !== baseTokenLower) {
    const tokenDec = await getTokenDecimalsCached(ctx, reserveLower);
    amountBase = normalizeDecimals(BigInt(amount), tokenDec, baseDec);
  }

  // ============================================================================
  // EER: Record FUNDS_DIVERTED event to inbox
  // ============================================================================
  const cfg = getEERConfigForVault(config, portVault.address);
  if (cfg) {
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=FUNDS_DIVERTED vault=${portVault.address} vaultId=${portVault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `strategy=AAVE reserve=${reserveLower} amountRaw=${amount.toString()} amountBase=${amountBase.toString()}`
    );
    await eerService.recordFundsDivertedEvent(
      ctx,
      portVault,
      amountBase,
      'AAVE',
      log,
      reserveLower,
      BigInt(amount),
      await getTokenDecimalsCached(ctx, reserveLower)
    );
  }

  const portFundsDiverted = new FundsDiverted({
    id: `${PortVaultAction.FUNDS_DIVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    amount: BigInt(amount),
    strategy: log.address.toLowerCase(),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  fundsDiverted.set(portFundsDiverted.id, portFundsDiverted);
  portVault.fundsDiverted = portVault.fundsDiverted + BigInt(amount);
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FUNDS_DIVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FUNDS_DIVERTED,
    details: `[AAVE] Funds diverted: $${Number((Number(amount) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities, fundsDiverted };
}

async function parseFundsReverted(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsReverted: Map<string, FundsReverted>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsReverted: Map<string, FundsReverted> }> {
  const { amount, user: vaultAddress, reserve, to } = AaveV3PoolAbi.events.Withdraw.decode(log);
  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == vaultAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    return { portVaults, portVaultActivities, fundsReverted };
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseFundsReverted failed.`, log.transactionHash);
  }

  if (portVault.fundsDiverted < BigInt(amount)) {
    ctx.log.warn(
      `[AAVE WITHDRAW] Funds diverted (${portVault.fundsDiverted.toString()}) is less than withdraw amount (${amount.toString()}). ` +
      `Clamping to available. txHash=${log.transactionHash}`
    )
  }

  ctx.log.info(
    `[AAVE WITHDRAW DEBUG] block=${log.block.height} txHash=${log.transactionHash} ` +
    `pool=${log.address.toLowerCase()} user=${vaultAddress.toLowerCase()} ` +
    `to=${to.toLowerCase()} reserve=${reserve.toLowerCase()} amount=${amount.toString()}`
  )

  // Normalize amount to base token decimals for EER tracking
  const reserveLower = reserve.toLowerCase();
  const baseTokenLower = portVault.baseToken.address.toLowerCase();
  const baseDec = Number(portVault.baseToken.decimals);
  let amountBase = BigInt(amount);
  
  // If reserve is not the base token, normalize decimals
  if (reserveLower !== baseTokenLower) {
    const tokenDec = await getTokenDecimalsCached(ctx, reserveLower);
    amountBase = normalizeDecimals(BigInt(amount), tokenDec, baseDec);
  }

  // ============================================================================
  // EER: Record FUNDS_REVERTED event to inbox
  // ============================================================================
  const cfg = getEERConfigForVault(config, portVault.address);
  if (cfg) {
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=FUNDS_REVERTED vault=${portVault.address} vaultId=${portVault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `strategy=AAVE reserve=${reserveLower} amountRaw=${amount.toString()} amountBase=${amountBase.toString()}`
    );
    await eerService.recordFundsRevertedEvent(
      ctx,
      portVault,
      amountBase,
      'AAVE',
      log,
      reserveLower,
      BigInt(amount),
      await getTokenDecimalsCached(ctx, reserveLower)
    );
  }

  const portFundsReverted = new FundsReverted({
    id: `${PortVaultAction.FUNDS_REVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    amount: BigInt(amount),
    strategy: log.address.toLowerCase(),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  fundsReverted.set(portFundsReverted.id, portFundsReverted);

  // Clamp to prevent negative values
  const newFundsDiverted = portVault.fundsDiverted - BigInt(amount)
  portVault.fundsDiverted = newFundsDiverted < 0n ? 0n : newFundsDiverted;
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FUNDS_REVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FUNDS_REVERTED,
    details: `[AAVE] Funds reverted: $${Number((Number(amount) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities, fundsReverted };
}

async function parseFundsDivertedToClearpool(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsDiverted: Map<string, FundsDiverted>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsDiverted: Map<string, FundsDiverted> }> {
  const { from, amount, to, shares } = BoringVaultAbi.events.Enter.decode(log);

  // Debug logging for all Clearpool Enter events
  ctx.log.info(
    `[CLEARPOOL ENTER DEBUG] block=${log.block.height} txHash=${log.transactionHash} ` +
    `clearpoolVault=${log.address.toLowerCase()} from=${from.toLowerCase()} to=${to.toLowerCase()} ` +
    `amount=${amount.toString()} shares=${shares.toString()}`
  )

  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == to.toLowerCase())?.address;
  if (!portVaultAddress) {
    ctx.log.info(
      `[CLEARPOOL ENTER DEBUG] No matching Port vault found for to=${to.toLowerCase()}. ` +
      `Available vaults: ${config.Port?.Vaults?.map(v => v.address.toLowerCase()).join(', ')}`
    )
    return { portVaults, portVaultActivities, fundsDiverted };
  }

  ctx.log.info(
    `[CLEARPOOL ENTER DEBUG] Matched Port vault: ${portVaultAddress} - marking for EER recompute`
  )

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseFundsDiverted failed.`, log.transactionHash);
  }

  // EER recompute happens at time window intervals - no event-triggered recompute

  const portFundsDiverted = new FundsDiverted({
    id: `${PortVaultAction.FUNDS_DIVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    amount: BigInt(amount),
    strategy: log.address.toLowerCase(),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  fundsDiverted.set(portFundsDiverted.id, portFundsDiverted);
  portVault.fundsDiverted = portVault.fundsDiverted + BigInt(amount);
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FUNDS_DIVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FUNDS_DIVERTED,
    details: `[Clearpool Vault] Funds diverted: $${Number((Number(amount) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities, fundsDiverted };
}

async function parseFundsRevertedFromClearpool(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsReverted: Map<string, FundsReverted>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsReverted: Map<string, FundsReverted> }> {
  const { offerToken: strategy, user: vaultAddress, wantAmountReceived } = AtomicQueueAbi.events.AtomicRequestFulfilled.decode(log);
  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == vaultAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    return { portVaults, portVaultActivities, fundsReverted };
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseFundsReverted failed.`, log.transactionHash);
  }

  if (portVault.fundsDiverted < BigInt(wantAmountReceived)) {
    ctx.log.warn(
      `[CLEARPOOL WITHDRAW] Funds diverted (${portVault.fundsDiverted.toString()}) is less than withdraw amount (${wantAmountReceived.toString()}). ` +
      `Clamping to available. txHash=${log.transactionHash}`
    )
  }

  // Amount is already in base token decimals (Clearpool vault uses base token)
  const amountBase = BigInt(wantAmountReceived);

  // ============================================================================
  // EER: Record FUNDS_REVERTED event to inbox
  // ============================================================================
  const cfg = getEERConfigForVault(config, portVault.address);
  if (cfg) {
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=FUNDS_REVERTED vault=${portVault.address} vaultId=${portVault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `strategy=CLEARPOOL amountBase=${amountBase.toString()}`
    );
    await eerService.recordFundsRevertedEvent(
      ctx,
      portVault,
      amountBase,
      'CLEARPOOL',
      log
    );
  }

  const portFundsReverted = new FundsReverted({
    id: `${PortVaultAction.FUNDS_REVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    amount: BigInt(wantAmountReceived),
    strategy: strategy.toLowerCase(),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  fundsReverted.set(portFundsReverted.id, portFundsReverted);

  // Clamp to prevent negative values
  const newFundsDivertedCp = portVault.fundsDiverted - BigInt(wantAmountReceived)
  portVault.fundsDiverted = newFundsDivertedCp < 0n ? 0n : newFundsDivertedCp;
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FUNDS_REVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FUNDS_REVERTED,
    details: `[Clearpool Vault] Funds reverted: $${Number((Number(wantAmountReceived) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities, fundsReverted };
}

async function parseFundsDivertedToCompound(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsDiverted: Map<string, FundsDiverted>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsDiverted: Map<string, FundsDiverted> }> {
  const { amount, from: vaultAddress } = CompoundUSDCAbi.events.Supply.decode(log);
  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == vaultAddress.toLowerCase())?.address;
  if (!portVaultAddress) {
    return { portVaults, portVaultActivities, fundsDiverted };
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseFundsDiverted failed.`, log.transactionHash);
  }

  // Compound USDC amount is already in base token decimals (USDC = base token)
  const amountBase = BigInt(amount);

  // ============================================================================
  // EER: Record FUNDS_DIVERTED event to inbox
  // ============================================================================
  const cfg = getEERConfigForVault(config, portVault.address);
  if (cfg) {
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=FUNDS_DIVERTED vault=${portVault.address} vaultId=${portVault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `strategy=COMPOUND amountBase=${amountBase.toString()}`
    );
    await eerService.recordFundsDivertedEvent(
      ctx,
      portVault,
      amountBase,
      'COMPOUND',
      log
    );
  }

  const portFundsDiverted = new FundsDiverted({
    id: `${PortVaultAction.FUNDS_DIVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    amount: BigInt(amount),
    strategy: log.address.toLowerCase(),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  fundsDiverted.set(portFundsDiverted.id, portFundsDiverted);
  portVault.fundsDiverted = portVault.fundsDiverted + BigInt(amount);
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FUNDS_DIVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FUNDS_DIVERTED,
    details: `[Compound] Funds diverted: $${Number((Number(amount) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities, fundsDiverted };
}

async function parseFundsRevertedFromCompound(ctx: ProcessorContext, log: Log, config: Config, portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsReverted: Map<string, FundsReverted>): Promise<{ portVaults: Map<string, PortVault>, portVaultActivities: Map<string, PortVaultActivity>, fundsReverted: Map<string, FundsReverted> }> {
  const { amount, to: vaultAddress } = CompoundUSDCAbi.events.Withdraw.decode(log);
  const portVaultAddress = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == vaultAddress.toLowerCase())?.address;

  if (!portVaultAddress) {
    return { portVaults, portVaultActivities, fundsReverted };
  }

  const portVault = portVaults.get(portVaultAddress.toLowerCase()) ?? await portService.getPortVaultByAddress(ctx, portVaultAddress);

  if (!portVault) {
    throwError(`Port vault not found - parseFundsReverted failed.`, log.transactionHash);
  }

  if (portVault.fundsDiverted < BigInt(amount)) {
    ctx.log.warn(
      `[COMPOUND WITHDRAW] Funds diverted (${portVault.fundsDiverted.toString()}) is less than withdraw amount (${amount.toString()}). ` +
      `Clamping to available. txHash=${log.transactionHash}`
    )
  }

  // Compound USDC amount is already in base token decimals (USDC = base token)
  const amountBase = BigInt(amount);

  // ============================================================================
  // EER: Record FUNDS_REVERTED event to inbox
  // ============================================================================
  const cfg = getEERConfigForVault(config, portVault.address);
  if (cfg) {
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=FUNDS_REVERTED vault=${portVault.address} vaultId=${portVault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${log.transactionHash} idx=${log.logIndex} ` +
      `strategy=COMPOUND amountBase=${amountBase.toString()}`
    );
    await eerService.recordFundsRevertedEvent(
      ctx,
      portVault,
      amountBase,
      'COMPOUND',
      log
    );
  }

  const portFundsReverted = new FundsReverted({
    id: `${PortVaultAction.FUNDS_REVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    amount: BigInt(amount),
    strategy: log.address.toLowerCase(),
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  fundsReverted.set(portFundsReverted.id, portFundsReverted);

  // Clamp to prevent negative values
  const newFundsDivertedCo = portVault.fundsDiverted - BigInt(amount)
  portVault.fundsDiverted = newFundsDivertedCo < 0n ? 0n : newFundsDivertedCo;
  portVaults.set(portVault.address.toLowerCase(), portVault);

  const portVaultActivity = new PortVaultActivity({
    id: `${PortVaultAction.FUNDS_REVERTED}-${portVaultAddress}-${log.transactionHash}`,
    vault: portVault,
    action: PortVaultAction.FUNDS_REVERTED,
    details: `[Compound] Funds reverted: $${Number((Number(amount) / (10 ** Number(portVault.baseToken.decimals))).toPrecision(6))}`,
    timestamp: BigInt(log.block.timestamp),
    txHash: log.transactionHash,
  });

  portVaultActivities.set(portVaultActivity.id, portVaultActivity);

  return { portVaults, portVaultActivities, fundsReverted };
}


/**
 * Parse a Transfer event to determine if it's a relevant borrower transfer.
 * 
 * This function handles:
 * 1. DRAWDOWN: vault -> borrower (any vault asset) => increases BorrowedAssetBalance
 * 2. TOPUP: borrower -> vault (base token only) => creates ManagerDeposit, does NOT modify BorrowedAssetBalance
 * 
 * Repayments are handled in parseAtomicRequestFulfilled(), not here.
 */
async function parseBorrowerTransfer(
  ctx: ProcessorContext,
  log: Log,
  config: Config,
  vaultAddress: string,
  portVaults: Map<string, PortVault>,
  managerWithdraws: Map<string, ManagerWithdraw>,
  managerDeposits: Map<string, ManagerDeposit>,
  portVaultActivities: Map<string, PortVaultActivity>
): Promise<{
  portVaults: Map<string, PortVault>;
  managerWithdraws: Map<string, ManagerWithdraw>;
  managerDeposits: Map<string, ManagerDeposit>;
  portVaultActivities: Map<string, PortVaultActivity>;
}> {
  const vaultAddrLower = vaultAddress.toLowerCase();

  // Decode Transfer event
  const { from, to, value } = ERC20Abi.events.Transfer.decode(log);
  const token = log.address.toLowerCase();
  const fromLower = from.toLowerCase();
  const toLower = to.toLowerCase();
  const txHash = log.transactionHash;
  const logIndex = log.logIndex;
  const isDebug = isEERDebugEnabled(config, vaultAddrLower);

  if (isDebug) {
    ctx.log.info(
      `[BORROWER TRANSFER DEBUG] Transfer detected: token=${token} from=${fromLower} to=${toLower} value=${value.toString()} vault=${vaultAddrLower}`
    );
  }

  // Load vault
  let vault = portVaults.get(vaultAddrLower) ?? (await portService.getPortVaultByAddress(ctx, vaultAddrLower));
  if (!vault) {
    ctx.log.warn(`[BORROWER TRANSFER] Vault ${vaultAddrLower} not found`);
    return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
  }
  portVaults.set(vaultAddrLower, vault);

  // Get EER config to get borrower
  const cfg = getEERConfigForVault(config, vaultAddrLower);
  if (!cfg) {
    if (isDebug) {
      ctx.log.info(`[BORROWER TRANSFER DEBUG] No EER config for vault ${vaultAddrLower}`);
    }
    return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
  }

  // Bug C Fix: Lowercase borrower for comparisons
  const borrowerLower = cfg.borrower.toLowerCase();

  // Case 1: DRAWDOWN - vault -> borrower (any vault asset)
  const isDrawdown = fromLower === vaultAddrLower && toLower === borrowerLower;
  if (isDrawdown) {
    // Bug D Fix: Normalize vault.assets to lowercase for comparison
    const vaultAssetsLower = vault.assets.map(a => a.toLowerCase());
    if (!vaultAssetsLower.includes(token)) {
      if (isDebug) {
        ctx.log.info(
          `[BORROWER TRANSFER DEBUG] Token ${token} not in vault ${vaultAddrLower} assets: ${vault.assets.join(', ')}`
        );
      }
      return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
    }

    if (isDebug) {
      ctx.log.info(
        `[BORROWER TRANSFER DEBUG] DRAWDOWN detected for vault=${vaultAddrLower}`
      );
    }

    // Get token decimals
    const tokenDecimals = await getTokenDecimalsCached(ctx, token);
    const baseDec = Number(vault.baseToken.decimals);

    // Normalize to base token decimals
    const amountBaseRaw = normalizeDecimals(value, tokenDecimals, baseDec);

    // Create entity ID
    const entityId = `${vault.id}-${token}-${txHash}-${logIndex}`;

    // Create ManagerWithdraw
    const entity = new ManagerWithdraw({
      id: entityId,
      vault,
      vaultAddress: vaultAddrLower,
      borrower: borrowerLower,
      token,
      amountRaw: value,
      tokenDecimals,
      amountBaseRaw,
      timestamp: BigInt(log.block.timestamp),
      block: BigInt(log.block.height),
      txHash,
      logIndex,
    });
    managerWithdraws.set(entityId, entity);

    if (isDebug) {
      ctx.log.info(
        `[BORROWER TRANSFER DEBUG] Created ManagerWithdraw: id=${entityId} amountRaw=${value.toString()} amountBaseRaw=${amountBaseRaw.toString()}`
      );
    }

    // Create PortVaultActivity for MANAGER_WITHDRAWN
    const activityId = `${vault.id}-${PortVaultAction.MANAGER_WITHDRAWN}-${txHash}-${logIndex}`;
    const amountRawFormatted = Number((Number(value) / (10 ** tokenDecimals)).toPrecision(6));
    const portVaultActivity = new PortVaultActivity({
      id: activityId,
      vault: vault,
      action: PortVaultAction.MANAGER_WITHDRAWN,
      details: `Borrower withdrew: ${amountRawFormatted}`,
      timestamp: BigInt(log.block.timestamp),
      txHash: txHash,
    });
    portVaultActivities.set(activityId, portVaultActivity);

    // ============================================================================
    // EER: ONE CALL ONLY - record event to inbox
    // Parser determines domain kind (MANAGER_WITHDRAW); eerService maps to EER event
    // ============================================================================
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=DRAWDOWN domainKind=MANAGER_WITHDRAW vault=${vault.address} vaultId=${vault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${txHash} idx=${logIndex} ` +
      `token=${token} amountRaw=${value.toString()} amountBaseRaw=${amountBaseRaw.toString()} tokenDecimals=${tokenDecimals}`
    );
    await eerService.recordBorrowerTransferEvent(ctx, vault, log, config, 'MANAGER_WITHDRAW');

    return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
  }

  // Case 2: TOPUP - borrower -> vault (base token only)
  const isTopup = fromLower === borrowerLower && toLower === vaultAddrLower;
  if (isTopup) {
    // Only handle base token topups
    const baseTokenAddrLower = vault.baseToken.address.toLowerCase();
    if (token !== baseTokenAddrLower) {
      if (isDebug) {
        ctx.log.info(
          `[BORROWER TRANSFER DEBUG] Topup with non-base token ignored: token=${token} baseToken=${baseTokenAddrLower}`
        );
      }
      return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
    }

    if (isDebug) {
      ctx.log.info(
        `[BORROWER TRANSFER DEBUG] TOPUP detected for vault=${vaultAddrLower}`
      );
    }

    // Get token decimals
    const tokenDecimals = await getTokenDecimalsCached(ctx, token);
    const baseDec = Number(vault.baseToken.decimals);

    // Normalize to base token decimals
    const amountBaseRaw = normalizeDecimals(value, tokenDecimals, baseDec);

    // Create entity ID
    const entityId = `${vault.id}-${token}-${txHash}-${logIndex}`;

    // Create ManagerDeposit
    const entity = new ManagerDeposit({
      id: entityId,
      vault,
      vaultAddress: vaultAddrLower,
      borrower: borrowerLower,
      token,
      amountRaw: value,
      tokenDecimals,
      amountBaseRaw,
      timestamp: BigInt(log.block.timestamp),
      block: BigInt(log.block.height),
      txHash,
      logIndex,
    });
    managerDeposits.set(entityId, entity);

    if (isDebug) {
      ctx.log.info(
        `[BORROWER TRANSFER DEBUG] Created ManagerDeposit: id=${entityId} amountRaw=${value.toString()} amountBaseRaw=${amountBaseRaw.toString()}`
      );
    }

    // Create PortVaultActivity for MANAGER_DEPOSITED
    const activityId = `${vault.id}-${PortVaultAction.MANAGER_DEPOSITED}-${txHash}-${logIndex}`;
    const amountRawFormatted = Number((Number(value) / (10 ** tokenDecimals)).toPrecision(6));
    const portVaultActivity = new PortVaultActivity({
      id: activityId,
      vault: vault,
      action: PortVaultAction.MANAGER_DEPOSITED,
      details: `Borrower deposited: ${amountRawFormatted}`,
      timestamp: BigInt(log.block.timestamp),
      txHash: txHash,
    });
    portVaultActivities.set(activityId, portVaultActivity);

    // ============================================================================
    // EER: ONE CALL ONLY - record event to inbox
    // Parser determines domain kind (MANAGER_DEPOSIT); eerService maps to EER event
    // ============================================================================
    const ts = toSec(log.block.timestamp);
    ctx.log.info(
      `[EER PARSER] kind=TOPUP domainKind=MANAGER_DEPOSIT vault=${vault.address} vaultId=${vault.id} ` +
      `block=${log.block.height} ts=${ts} tx=${txHash} idx=${logIndex} ` +
      `token=${token} amountRaw=${value.toString()} amountBaseRaw=${amountBaseRaw.toString()} tokenDecimals=${tokenDecimals}`
    );
    await eerService.recordBorrowerTransferEvent(ctx, vault, log, config, 'MANAGER_DEPOSIT');

    return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
  }

  // Not a drawdown or topup - ignore silently
  if (isDebug) {
    ctx.log.info(
      `[BORROWER TRANSFER DEBUG] Transfer doesn't match patterns: vault=${vaultAddrLower} borrower=${borrowerLower} from=${fromLower} to=${toLower}`
    );
  }

  return { portVaults, managerWithdraws, managerDeposits, portVaultActivities };
}

export const parserService = {
  parseVaultEnter,
  parseAtomicRequestUpdated,
  parseNaraRedemptionActivity,
  parseVaultStatusUpdate,
  parseNavUpdate,
  parseAssetAdded,
  parseAssetRemoved,
  parseAtomicRequestFulfilled,
  parseLendingRateUpdated,
  parseManagementFeeUpdated,
  parseFeesClaimed,
  parseDepositCapUpdated,
  parseFundsDiverted,
  parseFundsReverted,
  parseFundsDivertedToClearpool,
  parseFundsRevertedFromClearpool,
  parseFundsDivertedToCompound,
  parseFundsRevertedFromCompound,
  parseBorrowerTransfer,
}
