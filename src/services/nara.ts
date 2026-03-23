import * as ERC20Abi from '../abi/ERC20';
import { BigDecimal } from '@subsquid/big-decimal';
import { ProcessorContext } from '../common/processor';
import { Config, NaraReserveFundSource } from '../common/types';
import { readContract } from '../helpers/common';
import { NaraGlobalStats, Network, Token } from '../model';

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
    updatedAt: BigInt(blockTimestamp),
  };
}

async function updateGlobalStats(
  ctx: ProcessorContext,
  config: Config,
  naraGlobalStats: NaraGlobalStats
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
  naraGlobalStats.updatedAt = metrics.updatedAt;

  return naraGlobalStats;
}

export const naraService = {
  getGlobalStats,
  getMetricsAtBlock,
  updateGlobalStats,
};
