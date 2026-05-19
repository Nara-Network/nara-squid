import { Network, Token } from '../model';
import { ProcessorContext } from '../common/dataSet';
import { In } from 'typeorm';

const tokenReplacements: Record<string, string> = {
  USDX: 'USDC',
  WFLR: 'FLR',
  'S-DAI': 'DAI',
  'S-USDT': 'USDT',
  'S-USDC': 'USDC',
};

async function getNonPoolTokens(ctx: ProcessorContext, syncedNetwork: Network): Promise<Token[]> {
  return ctx.store
    .find(Token, { where: { network: syncedNetwork, isPoolToken: false } })
}

async function getTokenByAddress(ctx: ProcessorContext, address: string): Promise<Token | null> {
  const token = await ctx.store.findOne(Token, { where: { address: address.toLowerCase(), network: ctx.syncedNetwork } })
  return token ?? null
}

async function getTokensByAddress(ctx: ProcessorContext, addresses: string[]): Promise<Token[]> {
  return ctx.store.find(Token, { where: { address: In(addresses.map(a => a.toLowerCase())), network: ctx.syncedNetwork } })
}

function mapTokenNames(tokens: Token[]) {
  return tokens.reduce((acc, v) => {
    const symbol = tokenReplacements[v.symbol] || v.symbol;
    if (!acc.has(symbol)) {
      acc.add(symbol);
    }
    return acc;
  }, new Set());
}

async function getTokenBySymbol(ctx: ProcessorContext, symbol: string): Promise<Token | null> {
  const token = await ctx.store.findOne(Token, { where: { symbol } })
  return token ?? null
}

async function getTokensBySymbol(ctx: ProcessorContext, symbol: string): Promise<Token[]> {
  return ctx.store.find(Token, { where: { symbol } })
}

export const tokensService = {
  getNonPoolTokens,
  getTokenByAddress,
  getTokensByAddress,
  mapTokenNames,
  getTokenBySymbol,
  getTokensBySymbol
}

