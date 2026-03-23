import * as ERC20Abi from '../abi/ERC20';
import { BigDecimal } from '@subsquid/big-decimal';
import { ProcessorContext } from '../common/processor';
import { Config, NaraInvestmentVaultSource, NaraReserveFundSource } from '../common/types';
import { calculateUsdPriceInBN, convertToBaseTokenAmount, normalizeDecimals, readContract } from '../helpers/common';
import { NaraGlobalStats, Network, PortNavUpdate, PortVault, PortVaultType, Token } from '../model';
import { portService } from './port';

const NARA_USD_SYMBOL = 'NaraUSD';
const NARA_USD_PLUS_SYMBOL = 'NaraUSD+';

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

async function getReserveFundFormatted(
  ctx: ProcessorContext,
  reserveFundSources: NaraReserveFundSource[],
  blockHeight?: number
): Promise<BigDecimal | null> {
  if (reserveFundSources.length === 0) {
    return null;
  }

  let totalReserveFund = BigDecimal(0);

  for (const source of reserveFundSources) {
    const token = await getTokenBySymbol(ctx, source.tokenSymbol);
    if (!token) {
      ctx.log.warn(
        `[NARA] Reserve fund token ${source.tokenSymbol} not found for network=${ctx.syncedNetwork}`
      );
      return null;
    }

    const rawBalance = BigInt(
      await readContract(
        ctx,
        token.address,
        ERC20Abi,
        'balanceOf',
        { account: source.wallet },
        blockHeight ?? ctx.blocks[ctx.blocks.length - 1].header.height
      )
    );

    const formattedBalance = BigDecimal(rawBalance.toString()).div(
      BigDecimal((10n ** BigInt(token.decimals)).toString())
    );

    totalReserveFund = totalReserveFund.add(formattedBalance);
  }

  return totalReserveFund;
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
    rawSupply: naraUsdSupply,
    formattedSupply: naraUsdSupplyFormatted,
    decimals: naraUsdDecimals,
  } = await getFormattedSupply(ctx, naraUsdToken, blockHeight);
  const { formattedSupply: naraUsdPlusSupplyFormatted } = await getFormattedSupply(ctx, naraUsdPlusToken, blockHeight);
  const reserveFundSources = config.Nara?.ReserveFund ?? [];
  const reserveFundFormatted = await getReserveFundFormatted(ctx, reserveFundSources, blockHeight);

  const percentageStaked = naraUsdSupply > 0n
    ? naraUsdPlusSupplyFormatted.mul(BigDecimal(100)).div(naraUsdSupplyFormatted)
    : BigDecimal(0);
  const protocolBackingRatio = reserveFundFormatted !== null && naraUsdSupply > 0n
    ? naraUsdSupplyFormatted.add(reserveFundFormatted).div(naraUsdSupplyFormatted)
    : BigDecimal(0);

  if (reserveFundFormatted === null) {
    ctx.log.warn(
      `[NARA] Reserve fund is not configured for network=${ctx.syncedNetwork}; protocol backing ratio will remain 0`
    );
  }

  return {
    naraUsdSupply,
    naraUsdSupplyFormatted,
    naraUsdDecimals,
    reserveFundFormatted: reserveFundFormatted ?? BigDecimal(0),
    protocolBackingRatio,
    percentageStaked,
    cashAndEquivalentsFormatted: naraUsdSupplyFormatted.add(reserveFundFormatted ?? BigDecimal(0)),
    updatedAt: BigInt(blockTimestamp),
  };
}

function formatRawAmount(amount: bigint, decimals: number): BigDecimal {
  return BigDecimal(amount.toString()).div(BigDecimal((10n ** BigInt(decimals)).toString()));
}

async function getInvestmentValueFormatted(
  ctx: ProcessorContext,
  wallet: string,
  holding: NaraInvestmentVaultSource,
  blockHeight: number,
  portVaults: Map<string, PortVault>
): Promise<BigDecimal> {
  const vaultAddress = holding.vaultAddress.toLowerCase();
  const portVault = portVaults.get(vaultAddress) ?? await portService.getPortVaultByAddress(ctx, vaultAddress);

  if (!portVault) {
    ctx.log.warn(`[NARA] Investment vault ${holding.vaultAddress} not found`);
    return BigDecimal(0);
  }

  const tokenAddress = (holding.tokenAddress ?? holding.vaultAddress).toLowerCase();
  const shareBalance = BigInt(
    await readContract(
      ctx,
      tokenAddress,
      ERC20Abi,
      'balanceOf',
      { account: wallet },
      blockHeight
    )
  );

  if (shareBalance === 0n) {
    return BigDecimal(0);
  }

  const shareDecimals = tokenAddress === portVault.address
    ? portVault.decimals
    : Number(await readContract(ctx, tokenAddress, ERC20Abi, 'decimals', [], blockHeight));

  const valueBaseRaw = (shareBalance * convertToBaseTokenAmount(portVault.currentNav, BigInt(portVault.baseToken.decimals), BigInt(18))) / BigInt(10 ** shareDecimals);
  const baseToken = await getTokenBySymbol(ctx, portVault.baseToken.symbol);

  if (!baseToken) {
    ctx.log.warn(`[NARA] Base token ${portVault.baseToken.symbol} not found for vault ${portVault.address}`);
    return BigDecimal(0);
  }

  const priceInBN = calculateUsdPriceInBN(BigInt(10 ** Number(baseToken.decimals)), baseToken.price, BigInt(baseToken.decimals));
  const valueUsdRaw = (valueBaseRaw * priceInBN) / BigInt(10 ** Number(baseToken.decimals));

  return formatRawAmount(valueUsdRaw, Number(baseToken.decimals));
}

async function getInvestmentAssetsFormatted(
  ctx: ProcessorContext,
  config: Config,
  portVaults: Map<string, PortVault>,
  blockHeight: number
): Promise<BigDecimal> {
  const wallet = config.Nara?.InvestmentWallet;
  const investmentVaults = config.Nara?.InvestmentVaults ?? [];

  if (!wallet || investmentVaults.length === 0) {
    return BigDecimal(0);
  }

  let totalInvestments = BigDecimal(0);

  for (const holding of investmentVaults) {
    totalInvestments = totalInvestments.add(
      await getInvestmentValueFormatted(ctx, wallet, holding, blockHeight, portVaults)
    );
  }

  return totalInvestments;
}

async function getWeightedApy7d(
  ctx: ProcessorContext,
  config: Config,
  portVaults: Map<string, PortVault>,
  portNavUpdates: Map<string, PortNavUpdate>,
  currentTimestamp: number
): Promise<bigint> {
  let weightedApy = 0n;
  let totalWeight = 0n;

  for (const portVault of portVaults.values()) {
    if (portVault.type !== PortVaultType.STANDARD) {
      continue;
    }

    const startApyCalculationTimestamp = config.Port?.Vaults?.find((vault) => vault.address.toLowerCase() == portVault.address.toLowerCase())?.StartApyCalculationTimestamp;
    const tvlWeight = normalizeDecimals(portVault.tvl, Number(portVault.baseToken.decimals), 18);

    if (tvlWeight <= 0n) {
      continue;
    }

    const { apr } = await portService.calculateRollingAPR(
      ctx,
      portVault.address,
      portVault.currentNav,
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

  if (!isSynced) {
    return naraGlobalStats;
  }

  const block = ctx.blocks[ctx.blocks.length - 1];
  const metrics = await getMetricsAtBlock(ctx, config, block.header.height, block.header.timestamp);
  if (!metrics) return naraGlobalStats;

  naraGlobalStats.network = ctx.syncedNetwork as Network;
  naraGlobalStats.naraUsdSupply = metrics.naraUsdSupply;
  naraGlobalStats.naraUsdSupplyFormatted = metrics.naraUsdSupplyFormatted;
  naraGlobalStats.naraUsdDecimals = metrics.naraUsdDecimals;
  naraGlobalStats.reserveFundFormatted = metrics.reserveFundFormatted;
  naraGlobalStats.protocolBackingRatio = metrics.protocolBackingRatio;
  naraGlobalStats.percentageStaked = metrics.percentageStaked;
  naraGlobalStats.investmentAssetsFormatted = await getInvestmentAssetsFormatted(ctx, config, portVaults, block.header.height);
  naraGlobalStats.cashAndEquivalentsFormatted = metrics.cashAndEquivalentsFormatted;
  naraGlobalStats.totalAssetsFormatted = naraGlobalStats.cashAndEquivalentsFormatted.add(naraGlobalStats.investmentAssetsFormatted);
  naraGlobalStats.weightedApy7d = await getWeightedApy7d(ctx, config, portVaults, portNavUpdates, block.header.timestamp);
  naraGlobalStats.weightedTenorDays = null;
  naraGlobalStats.updatedAt = metrics.updatedAt;

  return naraGlobalStats;
}

export const naraService = {
  getGlobalStats,
  getMetricsAtBlock,
  updateGlobalStats,
};
