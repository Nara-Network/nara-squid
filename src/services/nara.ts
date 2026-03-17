import * as ERC20Abi from '../abi/ERC20';
import { BigDecimal } from '@subsquid/big-decimal';
import { ProcessorContext } from '../common/processor';
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
  token: Token
): Promise<{ rawSupply: bigint; formattedSupply: BigDecimal; decimals: number }> {
  const rawSupply = BigInt(
    await readContract(
      ctx,
      token.address,
      ERC20Abi,
      'totalSupply',
      [],
      ctx.blocks[ctx.blocks.length - 1].header.height
    )
  );
  const decimals = Number(token.decimals);
  const formattedSupply = BigDecimal(rawSupply.toString()).div(
    BigDecimal((10n ** BigInt(decimals)).toString())
  );

  return { rawSupply, formattedSupply, decimals };
}

async function updateGlobalStats(
  ctx: ProcessorContext,
  naraGlobalStats: NaraGlobalStats
): Promise<NaraGlobalStats> {
  const isSynced = ctx.isHead && ctx.blocks.length === 1;

  if (!isSynced) {
    return naraGlobalStats;
  }

  const naraUsdToken = await getTokenBySymbol(ctx, NARA_USD_SYMBOL);
  if (!naraUsdToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return naraGlobalStats;
  }

  const naraUsdPlusToken = await getTokenBySymbol(ctx, NARA_USD_PLUS_SYMBOL);
  if (!naraUsdPlusToken) {
    ctx.log.warn(`[NARA] Token ${NARA_USD_PLUS_SYMBOL} not found for network=${ctx.syncedNetwork}`);
    return naraGlobalStats;
  }

  // totalSupply already includes balances held by staking contracts, which remain in circulation.
  const {
    rawSupply: naraUsdSupply,
    formattedSupply: naraUsdSupplyFormatted,
    decimals: naraUsdDecimals,
  } = await getFormattedSupply(ctx, naraUsdToken);
  const { formattedSupply: naraUsdPlusSupplyFormatted } = await getFormattedSupply(ctx, naraUsdPlusToken);

  const percentageStaked = naraUsdSupply > 0n
    ? naraUsdPlusSupplyFormatted.mul(BigDecimal(100)).div(naraUsdSupplyFormatted)
    : BigDecimal(0);

  naraGlobalStats.network = ctx.syncedNetwork as Network;
  naraGlobalStats.naraUsdSupply = naraUsdSupply;
  naraGlobalStats.naraUsdSupplyFormatted = naraUsdSupplyFormatted;
  naraGlobalStats.naraUsdDecimals = naraUsdDecimals;
  naraGlobalStats.percentageStaked = percentageStaked;
  naraGlobalStats.updatedAt = BigInt(ctx.blocks[ctx.blocks.length - 1].header.timestamp);

  return naraGlobalStats;
}

export const naraService = {
  getGlobalStats,
  updateGlobalStats,
};
