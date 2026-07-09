import * as ERC20Abi from '../abi/ERC20';
import * as NaraUSDAbi from '../abi/NaraUSD';
import * as NaraUSDPlusAbi from '../abi/NaraUSDPlus';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import { BigDecimal } from '@subsquid/big-decimal';
import { ProcessorContext } from '../common/dataSet';
import { Config } from '../common/types';
import { convertToBaseTokenAmount, normalizeDecimals, readContract } from '../helpers/common';
import { NaraApyChartPoint, NaraGlobalStats, Network, PortNavUpdate, PortVault, PortVaultType, Token } from '../model';
import { portService } from './port';

const NARA_USD_SYMBOL = 'NaraUSD';
const NARA_USD_PLUS_SYMBOL = 'NaraUSD+';
// Previous anchor (kept for reference):
// export const START_APY_CALC_DATE = Date.UTC(2026, 2, 19, 0, 0, 0, 0);
// APR statistics now anchor to Ethereum mainnet block 25285744
// (2026-06-10T08:06:59Z), the first NaraUSD+ reward distribution. Value is the
// block timestamp in milliseconds, matching Subsquid's ms block timestamps.
export const START_APY_CALC_DATE = 1781078819000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SECONDS_PER_YEAR_52 = 52 * 7 * 24 * 60 * 60;
const MAX_APR_BPS = 100000;
const WALLET_METRICS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
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

function getAnkrBlockchain(network: Network): string[] | null {
  switch (network) {
    case Network.ETHEREUM:
      return ['eth'];
    default:
      return null;
  }
}

function hasNaraYieldMetrics(network: Network): boolean {
  return network !== Network.BSC;
}

function hasHubBackingMetrics(config: Config): boolean {
  return config.Nara != null;
}

function calculateVestingDistributionApr(params: {
  naraUsdSupply: bigint;
  naraUsdPlusTotalAssets: bigint;
  naraUsdPlusVestingAmount: bigint;
  naraUsdPlusLastDistributionAt: bigint;
  naraUsdPlusVestingPeriod: bigint;
  blockTimestamp: number;
}): bigint | null {
  const {
    naraUsdSupply,
    naraUsdPlusTotalAssets,
    naraUsdPlusVestingAmount,
    naraUsdPlusLastDistributionAt,
    naraUsdPlusVestingPeriod,
    blockTimestamp,
  } = params;

  if (
    naraUsdSupply <= 0n ||
    naraUsdPlusTotalAssets <= 0n ||
    naraUsdPlusLastDistributionAt <= 0n ||
    naraUsdPlusVestingPeriod <= 0n
  ) {
    return null;
  }

  if (naraUsdPlusVestingAmount === 0n) {
    return 0n;
  }

  const earningSupply = naraUsdSupply - naraUsdPlusVestingAmount;
  if (earningSupply <= 0n) {
    return null;
  }

  const supply = Number(naraUsdSupply);
  const totalAssets = Number(naraUsdPlusTotalAssets);
  const vesting = Number(naraUsdPlusVestingAmount);
  const earning = Number(earningSupply);
  const stakingRatio = totalAssets / supply;

  if (
    !Number.isFinite(supply) ||
    !Number.isFinite(totalAssets) ||
    !Number.isFinite(vesting) ||
    !Number.isFinite(earning) ||
    !Number.isFinite(stakingRatio) ||
    stakingRatio <= 0
  ) {
    return null;
  }

  const nowSeconds = Math.floor(blockTimestamp / 1000);
  const elapsedSinceDistribution = nowSeconds - Number(naraUsdPlusLastDistributionAt);
  const annualizationSeconds = Math.max(
    elapsedSinceDistribution,
    Number(naraUsdPlusVestingPeriod)
  );
  if (!Number.isFinite(annualizationSeconds) || annualizationSeconds <= 0) {
    return null;
  }

  const annualizationFactor = SECONDS_PER_YEAR_52 / annualizationSeconds;
  const aprFraction = ((vesting / earning) * annualizationFactor) / stakingRatio;
  const aprBps = Math.round(aprFraction * 10000);
  const clampedAprBps = Math.min(Math.max(aprBps, -MAX_APR_BPS), MAX_APR_BPS);

  if (!Number.isFinite(clampedAprBps) || Number.isNaN(clampedAprBps)) {
    return null;
  }

  return BigInt(clampedAprBps);
}

function getAnkrApiUrl(): string | null {
  const configuredUrl = process.env.ANKR_API_URL || process.env.NEXT_PUBLIC_ANKR_API_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const apiKey = process.env.ANKR_API_KEY;
  if (!apiKey) {
    return null;
  }

  return `${ANKR_MULTI_CHAIN_URL}/${apiKey}`;
}

function getWalletRefreshIntervalMs(isSynced: boolean): number {
  return isSynced ? WALLET_METRICS_REFRESH_INTERVAL_MS : DAY_MS;
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

function shouldUpdateGlobalStats(ctx: ProcessorContext, config: Config): boolean {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;
  const hasBackingMetrics = hasHubBackingMetrics(config);
  return isSynced || (hasBackingMetrics && shouldRefreshWalletMetrics(ctx));
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
    naraUsdPlusVestingAmount: 0n,
    naraUsdPlusLastDistributionAt: 0n,
    naraUsdPlusVestingPeriod: 0n,
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

async function getNaraUsdTotalSupplyAtBlock(
  ctx: ProcessorContext,
  blockHeight: number
): Promise<{
  rawSupply: bigint;
  formattedSupply: BigDecimal;
  decimals: number;
} | null> {
  const naraUsdToken = await getTokenBySymbol(ctx, NARA_USD_SYMBOL);
  if (!naraUsdToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  return getFormattedSupply(ctx, naraUsdToken, blockHeight);
}

async function getNaraUsdPlusTotalAssetsAtBlock(
  ctx: ProcessorContext,
  blockHeight: number
): Promise<{ rawAssets: bigint; formattedAssets: BigDecimal } | null> {
  if (!hasNaraYieldMetrics(ctx.syncedNetwork)) {
    return null;
  }

  const naraUsdPlusToken = await getTokenBySymbol(ctx, NARA_USD_PLUS_SYMBOL);
  if (!naraUsdPlusToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_PLUS_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  // NaraUSD+ is an ERC-4626 vault over NaraUSD, so totalAssets() returns the
  // underlying NaraUSD locked. We use the NaraUSD+ token decimals to format —
  // they match NaraUSD by design, so this also reads naturally in dollars.
  try {
    const rawAssets = BigInt(
      await readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'totalAssets',
        [],
        blockHeight
      )
    );
    const decimals = Number(naraUsdPlusToken.decimals);
    const formattedAssets = BigDecimal(rawAssets.toString()).div(
      BigDecimal((10n ** BigInt(decimals)).toString())
    );
    return { rawAssets, formattedAssets };
  } catch (error) {
    ctx.log.warn(
      `[NARA] Failed to read ${NARA_USD_PLUS_SYMBOL}.totalAssets at block=${blockHeight}: ${String(error)}`
    );
    return null;
  }
}

async function getNaraUsdPlusVestingDistributionAtBlock(
  ctx: ProcessorContext,
  blockHeight: number
): Promise<{
  vestingAmount: bigint;
  lastDistributionAt: bigint;
  vestingPeriod: bigint;
} | null> {
  if (!hasNaraYieldMetrics(ctx.syncedNetwork)) {
    return null;
  }

  const naraUsdPlusToken = await getTokenBySymbol(ctx, NARA_USD_PLUS_SYMBOL);
  if (!naraUsdPlusToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_PLUS_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  try {
    const [vestingAmount, lastDistributionAt, vestingPeriod] = await Promise.all([
      readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'vestingAmount',
        [],
        blockHeight
      ),
      readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'lastDistributionTimestamp',
        [],
        blockHeight
      ),
      readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'vestingPeriod',
        [],
        blockHeight
      ),
    ]);

    return {
      vestingAmount: BigInt(vestingAmount),
      lastDistributionAt: BigInt(lastDistributionAt),
      vestingPeriod: BigInt(vestingPeriod),
    };
  } catch (error) {
    ctx.log.warn(
      `[NARA] Failed to read ${NARA_USD_PLUS_SYMBOL} vesting distribution at block=${blockHeight}: ${String(error)}`
    );
    return null;
  }
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

async function getNaraUsdCashFormatted(
  ctx: ProcessorContext,
  blockHeight: number
): Promise<BigDecimal | null> {
  const naraUsdToken = await getTokenBySymbol(ctx, NARA_USD_SYMBOL);
  if (!naraUsdToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return null;
  }

  try {
    const assetAddress = String(
      await readContract(
        ctx,
        naraUsdToken.address,
        NaraUSDAbi,
        'asset',
        [],
        blockHeight
      )
    ).toLowerCase();
    const assetDecimals = Number(
      await readContract(
        ctx,
        assetAddress,
        ERC20Abi,
        'decimals',
        [],
        blockHeight
      )
    );
    const assetBalanceRaw = BigInt(
      await readContract(
        ctx,
        assetAddress,
        ERC20Abi,
        'balanceOf',
        { account: naraUsdToken.address },
        blockHeight
      )
    );

    return formatRawAmount(assetBalanceRaw, assetDecimals);
  } catch (error) {
    ctx.log.warn(
      `[NARA] Failed to fetch ${NARA_USD_SYMBOL} contract cash balance for address=${naraUsdToken.address} network=${ctx.syncedNetwork}: ${String(error)}`
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
  naraUsdPlusTotalAssets: bigint;
  naraUsdPlusVestingAmount: bigint;
  naraUsdPlusLastDistributionAt: bigint;
  naraUsdPlusVestingPeriod: bigint;
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
  const naraUsdSupply = naraUsdRawSupply;
  const naraUsdSupplyFormatted = naraUsdRawSupplyFormatted;
  let percentageStaked = BigDecimal(0);
  let naraUsdPlusTotalAssets = 0n;
  let naraUsdPlusVestingAmount = 0n;
  let naraUsdPlusLastDistributionAt = 0n;
  let naraUsdPlusVestingPeriod = 0n;

  if (hasNaraYieldMetrics(ctx.syncedNetwork)) {
    naraUsdPlusTotalAssets = BigInt(
      await readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'totalAssets',
        [],
        blockHeight
      )
    );
    const naraUsdPlusAssetsFormatted = BigDecimal(naraUsdPlusTotalAssets.toString()).div(
      BigDecimal((10n ** BigInt(naraUsdDecimals)).toString())
    );
    percentageStaked = naraUsdSupply > 0n
      ? naraUsdPlusAssetsFormatted.mul(BigDecimal(100)).div(naraUsdSupplyFormatted)
      : BigDecimal(0);

    // Latest NaraUSD+ vestingAmount() — the rewards currently being streamed into
    // the vault. Feeds the protocol APR formula in the app. Read failures are left
    // to propagate (as with totalAssets above) so the batch retries and the prior
    // persisted value is preserved rather than being overwritten with 0.
    naraUsdPlusVestingAmount = BigInt(
      await readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'vestingAmount',
        [],
        blockHeight
      )
    );

    // Reward-timing inputs for the app's APR annualizer: the timestamp of the
    // last reward distribution and the vesting period (both seconds). The app
    // annualizes by `secondsPerYear / max(now - lastDistribution, vestingPeriod)`.
    naraUsdPlusLastDistributionAt = BigInt(
      await readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'lastDistributionTimestamp',
        [],
        blockHeight
      )
    );
    naraUsdPlusVestingPeriod = BigInt(
      await readContract(
        ctx,
        naraUsdPlusToken.address,
        NaraUSDPlusAbi,
        'vestingPeriod',
        [],
        blockHeight
      )
    );
  }

  return {
    naraUsdSupply,
    naraUsdSupplyFormatted,
    naraUsdDecimals,
    naraUsdPlusTotalAssets,
    naraUsdPlusVestingAmount,
    naraUsdPlusLastDistributionAt,
    naraUsdPlusVestingPeriod,
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
    getNaraUsdCashFormatted(ctx, blockHeight),
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
  portNavUpdates: Map<string, PortNavUpdate>,
  naraApyChartPoints?: Map<string, NaraApyChartPoint>
): Promise<NaraGlobalStats> {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;
  const hasBackingMetrics = hasHubBackingMetrics(config);
  const shouldRefreshWallets = hasBackingMetrics && shouldRefreshWalletMetrics(ctx);

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
  naraGlobalStats.naraUsdPlusVestingAmount = metrics.naraUsdPlusVestingAmount;
  naraGlobalStats.naraUsdPlusLastDistributionAt = metrics.naraUsdPlusLastDistributionAt;
  naraGlobalStats.naraUsdPlusVestingPeriod = metrics.naraUsdPlusVestingPeriod;
  naraGlobalStats.percentageStaked = metrics.percentageStaked;
  naraGlobalStats.protocolBackingRatio = hasBackingMetrics && metrics.naraUsdSupply > 0n
    ? metrics.naraUsdSupplyFormatted.add(naraGlobalStats.reserveFundFormatted).div(metrics.naraUsdSupplyFormatted)
    : metrics.protocolBackingRatio;
  naraGlobalStats.totalAssetsFormatted = naraGlobalStats.cashAndEquivalentsFormatted.add(
    naraGlobalStats.investmentAssetsFormatted
  );

  if (!isSynced) {
    naraGlobalStats.updatedAt = metrics.updatedAt;
    return naraGlobalStats;
  }

  if (!hasNaraYieldMetrics(ctx.syncedNetwork)) {
    naraGlobalStats.apy7d = 0n;
    naraGlobalStats.apy14d = 0n;
    naraGlobalStats.apy30d = 0n;
    naraGlobalStats.weightedApy7d = 0n;
    naraGlobalStats.weightedTenorDays = null;
    naraGlobalStats.updatedAt = metrics.updatedAt;
    return naraGlobalStats;
  }

  const dbLatestApyChartPoints = await ctx.store.find(NaraApyChartPoint, {
    where: { network: ctx.syncedNetwork },
    order: { timestamp: 'DESC' },
    take: 1,
  });
  const memLatestApyChartPoint = naraApyChartPoints
    ? Array.from(naraApyChartPoints.values())
        .filter((point) => point.network === ctx.syncedNetwork)
        .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0]
    : undefined;
  const latestApyChartPoint = [dbLatestApyChartPoints[0], memLatestApyChartPoint]
    .filter((point): point is NaraApyChartPoint => point != null)
    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))[0];
  naraGlobalStats.apy7d = latestApyChartPoint?.apy7d ?? 0n;
  naraGlobalStats.apy14d = latestApyChartPoint?.apy14d ?? 0n;
  naraGlobalStats.apy30d = latestApyChartPoint?.apy30d ?? 0n;
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
  calculateVestingDistributionApr,
  getGlobalStats,
  hasNaraYieldMetrics,
  shouldUpdateGlobalStats,
  getNaraUsdPlusTotalAssetsAtBlock,
  getNaraUsdPlusVestingDistributionAtBlock,
  getNaraUsdTotalSupplyAtBlock,
  getMetricsAtBlock,
  updateGlobalStats,
};
