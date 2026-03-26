import * as ERC20Abi from '../abi/ERC20';
import * as NaraUSDPlusAbi from '../abi/NaraUSDPlus';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import { BigDecimal } from '@subsquid/big-decimal';
import { ProcessorContext } from '../common/processor';
import { Config } from '../common/types';
import { convertToBaseTokenAmount, normalizeDecimals, readContract } from '../helpers/common';
import { NaraApyChartPoint, NaraGlobalStats, Network, PortNavUpdate, PortVault, PortVaultType, Token } from '../model';
import { portService } from './port';
import { Between, MoreThanOrEqual } from 'typeorm';

const NARA_USD_SYMBOL = 'NaraUSD';
const NARA_USD_PLUS_SYMBOL = 'NaraUSD+';
export const START_APY_CALC_DATE = Date.UTC(2026, 2, 19, 0, 0, 0, 0);
const EXCHANGE_RATE_DECIMALS = 18n;
const MIN_HOURS_FOR_APR = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const ANKR_MULTI_CHAIN_URL = 'https://rpc.ankr.com/multichain';

type AnkrTokenBalance = {
  contractAddress?: string;
  balanceUsd?: string;
};

type AnkrAccountBalanceResponse = {
  result?: {
    totalBalanceUsd?: string;
    assets?: AnkrTokenBalance[];
  };
};

const LAST_WALLET_BALANCE_REFRESH_AT = new Map<string, number>();

function getDayEndTimestamp(timestampMs: number): number {
  const date = new Date(timestampMs);
  date.setUTCHours(23, 59, 59, 999);
  return date.getTime();
}

function getFirstEligibleApyTimestamp(days: number): number {
  return getDayEndTimestamp(START_APY_CALC_DATE + ((days - 1) * DAY_MS));
}

function getAnkrBlockchain(network: Network): string[] | null {
  switch (network) {
    case Network.ARBITRUM:
      return ['arbitrum'];
    default:
      return null;
  }
}

function getAnkrApiUrl(): string | null {
  const configuredUrl = process.env.ANKR_API_URL || process.env.NEXT_PUBLIC_ANKR_API_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const apiKey = process.env.ANKR_API_KEY_ARBITRUM || process.env.ARBITRUM_API_KEY || process.env.ANKR_API_KEY;
  if (!apiKey) {
    return null;
  }

  return `${ANKR_MULTI_CHAIN_URL}/${apiKey}`;
}

function getWalletRefreshIntervalMs(isSynced: boolean): number {
  return isSynced ? HOUR_MS : DAY_MS;
}

function getWalletRefreshCacheKey(ctx: ProcessorContext): string {
  return `${ctx.syncedNetwork}`;
}

function shouldRefreshWalletMetrics(ctx: ProcessorContext): boolean {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;
  const intervalMs = getWalletRefreshIntervalMs(isSynced);
  const nowTs = ctx.blocks[ctx.blocks.length - 1].header.timestamp;
  const cacheKey = getWalletRefreshCacheKey(ctx);
  const lastRefreshAt = LAST_WALLET_BALANCE_REFRESH_AT.get(cacheKey) ?? 0;

  if (lastRefreshAt === 0) {
    return true;
  }

  return nowTs - lastRefreshAt >= intervalMs;
}

async function getAccountBalanceUsd(
  walletAddress: string,
  network: Network
): Promise<BigDecimal | null> {
  const apiUrl = getAnkrApiUrl();
  if (!apiUrl) {
    return null;
  }

  const blockchain = getAnkrBlockchain(network);
  if (!blockchain) {
    return null;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'ankr_getAccountBalance',
      params: {
        walletAddress,
        blockchain,
      },
      id: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ankr API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as AnkrAccountBalanceResponse;
  const totalBalanceUsd = data.result?.totalBalanceUsd;

  if (!totalBalanceUsd) {
    return BigDecimal(0);
  }

  return BigDecimal(totalBalanceUsd);
}

async function getGlobalStats(ctx: ProcessorContext): Promise<NaraGlobalStats> {
  const existingStats = await ctx.store.findOne(NaraGlobalStats, {
    where: { id: ctx.syncedNetwork },
  });

  if (existingStats) {
    return existingStats;
  }

  return new NaraGlobalStats({
    id: ctx.syncedNetwork,
    network: ctx.syncedNetwork,
    naraUsdSupply: 0n,
    naraUsdSupplyFormatted: BigDecimal(0),
    naraUsdDecimals: 18,
    reserveFundFormatted: BigDecimal(0),
    protocolBackingRatio: BigDecimal(0),
    percentageStaked: BigDecimal(0),
    investmentAssetsFormatted: BigDecimal(0),
    cashAndEquivalentsFormatted: BigDecimal(0),
    totalAssetsFormatted: BigDecimal(0),
    apy7d: 0n,
    apy14d: 0n,
    apy30d: 0n,
    weightedApy7d: 0n,
    updatedAt: 0n,
  });
}

async function getTokenBySymbol(ctx: ProcessorContext, symbol: string): Promise<Token | null> {
  const token = await ctx.store.findOne(Token, {
    where: {
      network: ctx.syncedNetwork,
      symbol,
    },
  });

  return token ?? null;
}

async function getFormattedSupply(
  ctx: ProcessorContext,
  token: Token,
  blockHeight?: number
): Promise<{ rawSupply: bigint; formattedSupply: BigDecimal; decimals: number }> {
  const rawSupply = BigInt(
    await readContract(
      ctx,
      token.address,
      ERC20Abi,
      'totalSupply',
      [],
      blockHeight ?? ctx.blocks[ctx.blocks.length - 1].header.height
    )
  );
  const decimals = Number(token.decimals);
  const formattedSupply = BigDecimal(rawSupply.toString()).div(
    BigDecimal((10n ** BigInt(decimals)).toString())
  );

  return { rawSupply, formattedSupply, decimals };
}

async function getNaraUsdPlusExchangeRateAtBlock(
  ctx: ProcessorContext,
  blockHeight: number
): Promise<bigint | null> {
  const naraUsdPlusToken = await getTokenBySymbol(ctx, NARA_USD_PLUS_SYMBOL);
  if (!naraUsdPlusToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_PLUS_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  try {
    const oneShareRaw = 10n ** BigInt(naraUsdPlusToken.decimals);
    return BigInt(
      await readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'previewMint',
        { shares: oneShareRaw },
        blockHeight
      )
    );
  } catch (error) {
    ctx.log.warn(
      `[NARA] Failed to read ${NARA_USD_PLUS_SYMBOL}.previewMint at block=${blockHeight}: ${String(error)}`
    );
    return null;
  }
}

async function getNaraApyReferencePoints(
  ctx: ProcessorContext,
  cutoffTimestamp: number,
  naraApyChartPoints?: Map<string, NaraApyChartPoint>
): Promise<{
  historicalPoint: NaraApyChartPoint | null;
  earliestPoint: NaraApyChartPoint | null;
}> {
  const effectiveCutoffTimestamp = Math.max(cutoffTimestamp, START_APY_CALC_DATE);
  const [dbHistoricalPoint, dbEarliestPoint] = await Promise.all([
    ctx.store.find(NaraApyChartPoint, {
      where: {
        network: ctx.syncedNetwork,
        timestamp: Between(BigInt(START_APY_CALC_DATE), BigInt(effectiveCutoffTimestamp)),
      },
      order: { timestamp: 'DESC' },
      take: 1,
    }),
    ctx.store.find(NaraApyChartPoint, {
      where: {
        network: ctx.syncedNetwork,
        timestamp: MoreThanOrEqual(BigInt(START_APY_CALC_DATE)),
      },
      order: { timestamp: 'ASC' },
      take: 1,
    }),
  ]);

  const memPoints = naraApyChartPoints
    ? Array.from(naraApyChartPoints.values()).filter(
        (point) => point.network === ctx.syncedNetwork && Number(point.timestamp) >= START_APY_CALC_DATE
      )
    : [];

  const memHistoricalPoint = memPoints
    .filter((point) => Number(point.timestamp) <= effectiveCutoffTimestamp)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0] ?? null;
  const memEarliestPoint = memPoints
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))[0] ?? null;

  const historicalPoint = [dbHistoricalPoint[0] ?? null, memHistoricalPoint]
    .filter((point): point is NaraApyChartPoint => point !== null)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0] ?? null;
  const earliestPoint = [dbEarliestPoint[0] ?? null, memEarliestPoint]
    .filter((point): point is NaraApyChartPoint => point !== null)
    .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))[0] ?? null;

  return { historicalPoint, earliestPoint };
}

async function calculateRollingAPR(
  ctx: ProcessorContext,
  currentExchangeRate: bigint,
  currentTimestamp: number,
  days: number,
  naraApyChartPoints?: Map<string, NaraApyChartPoint>
): Promise<{ apr: bigint | null; historicalER: bigint }> {
  if (getDayEndTimestamp(currentTimestamp) < getFirstEligibleApyTimestamp(days)) {
    return { apr: null, historicalER: 10n ** EXCHANGE_RATE_DECIMALS };
  }

  const daysAgoStart = currentTimestamp - (days * 24 * 60 * 60 * 1000);
  const daysAgoDate = new Date(daysAgoStart);
  daysAgoDate.setHours(23, 59, 59, 999);
  const cutoffTimestamp = daysAgoDate.getTime();

  const { historicalPoint } = await getNaraApyReferencePoints(
    ctx,
    cutoffTimestamp,
    naraApyChartPoints
  );

  let historicalER = 10n ** EXCHANGE_RATE_DECIMALS;
  let annualizationFactor: number;

  if (cutoffTimestamp < START_APY_CALC_DATE) {
    const elapsedDays = Math.max(
      (currentTimestamp - START_APY_CALC_DATE) / DAY_MS,
      MIN_HOURS_FOR_APR / 24
    );
    annualizationFactor = 365 / elapsedDays;
  } else if (historicalPoint) {
    const historicalExchangeRate = await getNaraUsdPlusExchangeRateAtBlock(
      ctx,
      Number(historicalPoint.block)
    );

    if (historicalExchangeRate == null || historicalExchangeRate === 0n) {
      ctx.log.warn(
        `[NARA Rolling APR] Invalid historical exchange rate for network=${ctx.syncedNetwork} block=${historicalPoint.block}, using 1.0`
      );
    } else {
      historicalER = historicalExchangeRate;
    }

    annualizationFactor = Math.round(365 / days);
  } else {
    annualizationFactor = Math.round(365 / days);
  }

  if (currentExchangeRate === 0n) {
    ctx.log.warn(`[NARA Rolling APR] Invalid current exchange rate (0) for network=${ctx.syncedNetwork}`);
    return { apr: null, historicalER };
  }

  const erPast = Number(historicalER) / Number(10n ** EXCHANGE_RATE_DECIMALS);
  if (erPast === 0) {
    ctx.log.warn(`[NARA Rolling APR] Invalid past exchange rate (0) for network=${ctx.syncedNetwork}`);
    return { apr: null, historicalER };
  }

  const erCurrent = Number(currentExchangeRate) / Number(10n ** EXCHANGE_RATE_DECIMALS);
  const exchangeRateReturn = erCurrent / erPast;
  const apr = (exchangeRateReturn - 1) * annualizationFactor;
  const aprBps = Math.round(apr * 10000);

  const MAX_APR_BPS = 100000;
  const clampedAprBps = Math.min(Math.max(aprBps, -MAX_APR_BPS), MAX_APR_BPS);

  if (!Number.isFinite(clampedAprBps) || Number.isNaN(clampedAprBps)) {
    ctx.log.warn(
      `[NARA Rolling APR] Invalid aprBps=${aprBps} for network=${ctx.syncedNetwork}`
    );
    return { apr: null, historicalER };
  }

  return { apr: BigInt(clampedAprBps), historicalER };
}

async function calculateActualAPR(
  ctx: ProcessorContext,
  currentExchangeRate: bigint,
  currentTimestamp: number,
  naraApyChartPoints?: Map<string, NaraApyChartPoint>
): Promise<bigint | null> {
  if (getDayEndTimestamp(currentTimestamp) < getFirstEligibleApyTimestamp(7)) {
    return null;
  }

  const actualDaysElapsed =
    (currentTimestamp - START_APY_CALC_DATE) / (24 * 60 * 60 * 1000);

  if (actualDaysElapsed < (MIN_HOURS_FOR_APR / 24)) {
    return null;
  }

  if (currentExchangeRate === 0n) {
    ctx.log.warn(`[NARA APR] Invalid current exchange rate (0) for network=${ctx.syncedNetwork}`);
    return null;
  }

  const erPast = 1;
  const erCurrent = Number(currentExchangeRate) / Number(10n ** EXCHANGE_RATE_DECIMALS);
  const exchangeRateReturn = erCurrent / erPast;
  const apr = (exchangeRateReturn - 1) * (365 / actualDaysElapsed);
  const aprBps = Math.round(apr * 10000);

  const MAX_APR_BPS = 100000;
  const clampedAprBps = Math.min(Math.max(aprBps, -MAX_APR_BPS), MAX_APR_BPS);

  if (!Number.isFinite(clampedAprBps) || Number.isNaN(clampedAprBps)) {
    ctx.log.warn(`[NARA APR] Invalid aprBps=${aprBps} for network=${ctx.syncedNetwork}`);
    return null;
  }

  return BigInt(clampedAprBps);
}

async function getReserveFundFormatted(
  ctx: ProcessorContext,
  walletAddress?: string | null
): Promise<BigDecimal | null> {
  if (!walletAddress) {
    return BigDecimal(0);
  }

  try {
    return await getAccountBalanceUsd(walletAddress, ctx.syncedNetwork);
  } catch (error) {
    ctx.log.warn(
      `[NARA] Failed to fetch reserve fund balance for wallet=${walletAddress} network=${ctx.syncedNetwork}: ${String(error)}`
    );
    return null;
  }
}

async function getNaraUsdCashFormatted(ctx: ProcessorContext): Promise<BigDecimal | null> {
  const naraUsdToken = await getTokenBySymbol(ctx, NARA_USD_SYMBOL);
  if (!naraUsdToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  try {
    return await getAccountBalanceUsd(naraUsdToken.address, ctx.syncedNetwork);
  } catch (error) {
    ctx.log.warn(
      `[NARA] Failed to fetch ${NARA_USD_SYMBOL} contract balance for address=${naraUsdToken.address} network=${ctx.syncedNetwork}: ${String(error)}`
    );
    return null;
  }
}

async function getMetricsAtBlock(
  ctx: ProcessorContext,
  config: Config,
  blockHeight: number,
  blockTimestamp: number
): Promise<{
  naraUsdSupply: bigint;
  naraUsdSupplyFormatted: BigDecimal;
  naraUsdDecimals: number;
  reserveFundFormatted: BigDecimal;
  protocolBackingRatio: BigDecimal;
  percentageStaked: BigDecimal;
  cashAndEquivalentsFormatted: BigDecimal;
  updatedAt: bigint;
} | null> {
  const naraUsdToken = await getTokenBySymbol(ctx, NARA_USD_SYMBOL);
  if (!naraUsdToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  const naraUsdPlusToken = await getTokenBySymbol(ctx, NARA_USD_PLUS_SYMBOL);
  if (!naraUsdPlusToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_PLUS_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  const {
    rawSupply: naraUsdRawSupply,
    formattedSupply: naraUsdRawSupplyFormatted,
    decimals: naraUsdDecimals,
  } = await getFormattedSupply(ctx, naraUsdToken, blockHeight);
  const naraUsdPlusAssetsRaw = BigInt(
    await readContract(
      ctx,
      naraUsdPlusToken.address,
      NaraUSDPlusAbi,
      'totalAssets',
      [],
      blockHeight
    )
  );
  const naraUsdPlusAssetsFormatted = BigDecimal(naraUsdPlusAssetsRaw.toString()).div(
    BigDecimal((10n ** BigInt(naraUsdDecimals)).toString())
  );
  const naraUsdSupply = naraUsdRawSupply + naraUsdPlusAssetsRaw;
  const naraUsdSupplyFormatted = naraUsdRawSupplyFormatted.add(naraUsdPlusAssetsFormatted);

  const percentageStaked = naraUsdSupply > 0n
    ? naraUsdPlusAssetsFormatted.mul(BigDecimal(100)).div(naraUsdSupplyFormatted)
    : BigDecimal(0);

  return {
    naraUsdSupply,
    naraUsdSupplyFormatted,
    naraUsdDecimals,
    reserveFundFormatted: BigDecimal(0),
    protocolBackingRatio: BigDecimal(0),
    percentageStaked,
    cashAndEquivalentsFormatted: BigDecimal(0),
    updatedAt: BigInt(blockTimestamp),
  };
}

function formatRawAmount(amount: bigint, decimals: number): BigDecimal {
  return BigDecimal(amount.toString()).div(BigDecimal((10n ** BigInt(decimals)).toString()));
}

async function getInvestmentPosition(
  ctx: ProcessorContext,
  wallet: string,
  portVault: PortVault,
  blockHeight: number
): Promise<{ currentNav: bigint; valueBaseRaw: bigint }> {
  const shareBalance = BigInt(
    await readContract(
      ctx,
      portVault.address,
      ERC20Abi,
      'balanceOf',
      { account: wallet },
      blockHeight
    )
  );

  if (shareBalance === 0n) {
    return {
      currentNav: 0n,
      valueBaseRaw: 0n,
    };
  }

  const currentNav = BigInt(
    await readContract(ctx, portVault.accountant, AccountantAbi, 'getRate', [], blockHeight)
  );
  const valueBaseRaw = (shareBalance * convertToBaseTokenAmount(currentNav, BigInt(portVault.baseToken.decimals), BigInt(18))) / BigInt(10 ** portVault.decimals);

  return {
    currentNav,
    valueBaseRaw,
  };
}

async function getInvestmentValueFormatted(
  ctx: ProcessorContext,
  wallet: string,
  portVault: PortVault,
  blockHeight: number
): Promise<BigDecimal> {
  const { valueBaseRaw } = await getInvestmentPosition(ctx, wallet, portVault, blockHeight);

  return formatRawAmount(valueBaseRaw, Number(portVault.baseToken.decimals));
}

async function getInvestmentAssetsFormatted(
  ctx: ProcessorContext,
  config: Config,
  portVaults: Map<string, PortVault>,
  blockHeight: number
): Promise<BigDecimal> {
  const wallet = config.Nara?.Investments;

  if (!wallet) {
    return BigDecimal(0);
  }

  let totalInvestments = BigDecimal(0);

  for (const holding of portVaults.values()) {
    totalInvestments = totalInvestments.add(
      await getInvestmentValueFormatted(ctx, wallet, holding, blockHeight)
    );
  }

  return totalInvestments;
}

async function refreshWalletBackedMetrics(
  ctx: ProcessorContext,
  config: Config,
  naraGlobalStats: NaraGlobalStats,
  portVaults: Map<string, PortVault>,
  blockHeight: number
): Promise<NaraGlobalStats> {
  const reserveFundWallet = config.Nara?.ReserveFund;
  const investmentsWallet = config.Nara?.Investments;
  const previousReserveFundFormatted = naraGlobalStats.reserveFundFormatted;
  const previousNaraUsdCashFormatted = naraGlobalStats.cashAndEquivalentsFormatted.minus(
    previousReserveFundFormatted
  );

  const [reserveFundFormatted, naraUsdCashFormatted, investmentAssetsFormatted] = await Promise.all([
    getReserveFundFormatted(ctx, reserveFundWallet),
    getNaraUsdCashFormatted(ctx),
    investmentsWallet ? getInvestmentAssetsFormatted(ctx, config, portVaults, blockHeight) : Promise.resolve(BigDecimal(0)),
  ]);

  const nextReserveFundFormatted = reserveFundFormatted ?? previousReserveFundFormatted;
  const nextNaraUsdCashFormatted = naraUsdCashFormatted ?? previousNaraUsdCashFormatted;

  naraGlobalStats.reserveFundFormatted = nextReserveFundFormatted;
  naraGlobalStats.investmentAssetsFormatted = investmentAssetsFormatted;
  naraGlobalStats.cashAndEquivalentsFormatted = nextNaraUsdCashFormatted.add(
    nextReserveFundFormatted
  );
  naraGlobalStats.totalAssetsFormatted = naraGlobalStats.cashAndEquivalentsFormatted.add(
    naraGlobalStats.investmentAssetsFormatted
  );
  LAST_WALLET_BALANCE_REFRESH_AT.set(
    getWalletRefreshCacheKey(ctx),
    ctx.blocks[ctx.blocks.length - 1].header.timestamp
  );

  return naraGlobalStats;
}

async function getWeightedApy7d(
  ctx: ProcessorContext,
  config: Config,
  portVaults: Map<string, PortVault>,
  portNavUpdates: Map<string, PortNavUpdate>,
  currentTimestamp: number,
  blockHeight: number
): Promise<bigint> {
  const wallet = config.Nara?.Investments;

  if (!wallet) {
    return 0n;
  }

  let weightedApy = 0n;
  let totalWeight = 0n;

  for (const portVault of portVaults.values()) {
    if (portVault.type !== PortVaultType.STANDARD) {
      continue;
    }

    const startApyCalculationTimestamp = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == portVault.address.toLowerCase())?.StartApyCalculationTimestamp;
    const { currentNav, valueBaseRaw } = await getInvestmentPosition(
      ctx,
      wallet,
      portVault,
      blockHeight
    );
    const tvlWeight = normalizeDecimals(valueBaseRaw, Number(portVault.baseToken.decimals), 18);

    if (tvlWeight <= 0n) {
      continue;
    }

    const { apr } = await portService.calculateRollingAPR(
      ctx,
      portVault.address,
      currentNav,
      currentTimestamp,
      7,
      portVault.startedAt,
      startApyCalculationTimestamp,
      portNavUpdates
    );

    if (apr === null) {
      continue;
    }

    weightedApy += apr * tvlWeight;
    totalWeight += tvlWeight;
  }

  return totalWeight > 0n ? weightedApy / totalWeight : 0n;
}

async function updateGlobalStats(
  ctx: ProcessorContext,
  config: Config,
  naraGlobalStats: NaraGlobalStats,
  portVaults: Map<string, PortVault>,
  portNavUpdates: Map<string, PortNavUpdate>
): Promise<NaraGlobalStats> {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;
  const shouldRefreshWallets = shouldRefreshWalletMetrics(ctx);

  if (!isSynced && !shouldRefreshWallets) {
    return naraGlobalStats;
  }

  const block = ctx.blocks[ctx.blocks.length - 1];
  if (shouldRefreshWallets) {
    naraGlobalStats = await refreshWalletBackedMetrics(
      ctx,
      config,
      naraGlobalStats,
      portVaults,
      block.header.height
    );
  }

  const metrics = await getMetricsAtBlock(ctx, config, block.header.height, block.header.timestamp);
  if (!metrics) return naraGlobalStats;

  naraGlobalStats.network = ctx.syncedNetwork as Network;
  naraGlobalStats.naraUsdSupply = metrics.naraUsdSupply;
  naraGlobalStats.naraUsdSupplyFormatted = metrics.naraUsdSupplyFormatted;
  naraGlobalStats.naraUsdDecimals = metrics.naraUsdDecimals;
  naraGlobalStats.percentageStaked = metrics.percentageStaked;
  naraGlobalStats.protocolBackingRatio = metrics.naraUsdSupply > 0n
    ? metrics.naraUsdSupplyFormatted.add(naraGlobalStats.reserveFundFormatted).div(metrics.naraUsdSupplyFormatted)
    : BigDecimal(0);
  naraGlobalStats.totalAssetsFormatted = naraGlobalStats.cashAndEquivalentsFormatted.add(
    naraGlobalStats.investmentAssetsFormatted
  );

  if (!isSynced) {
    naraGlobalStats.updatedAt = metrics.updatedAt;
    return naraGlobalStats;
  }

  const currentExchangeRate = await getNaraUsdPlusExchangeRateAtBlock(ctx, block.header.height);
  const [apy7d, apy14d, apy30d] = currentExchangeRate == null
    ? [
        { apr: null as bigint | null },
        { apr: null as bigint | null },
        { apr: null as bigint | null },
      ]
    : await Promise.all([
        calculateRollingAPR(ctx, currentExchangeRate, block.header.timestamp, 7),
        calculateRollingAPR(ctx, currentExchangeRate, block.header.timestamp, 14),
        calculateRollingAPR(ctx, currentExchangeRate, block.header.timestamp, 30),
      ]);
  naraGlobalStats.apy7d = apy7d.apr ?? 0n;
  naraGlobalStats.apy14d = apy14d.apr ?? 0n;
  naraGlobalStats.apy30d = apy30d.apr ?? 0n;
  naraGlobalStats.weightedApy7d = await getWeightedApy7d(
    ctx,
    config,
    portVaults,
    portNavUpdates,
    block.header.timestamp,
    block.header.height
  );
  naraGlobalStats.weightedTenorDays = null;
  naraGlobalStats.updatedAt = metrics.updatedAt;

  return naraGlobalStats;
}

export const naraService = {
  calculateActualAPR,
  calculateRollingAPR,
  getGlobalStats,
  getNaraUsdPlusExchangeRateAtBlock,
  getMetricsAtBlock,
  updateGlobalStats,
};
