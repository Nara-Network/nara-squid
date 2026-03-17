import { Network, Token } from '../../model';
import { ProcessorContext } from '../processor';
import { BigDecimal } from '@subsquid/big-decimal';
import { getTokenId } from './helpers';
import { tokensService } from '../../services/tokens';


let hasInitialized = {
    [Network.ARBITRUM]: false,
    [Network.ARBITRUM_SEPOLIA]: false,
}

type TokenConfig = {
    symbol: string;
    address: string;
    name: string;
    network: Network;
    decimals: bigint;
    tvlMultiplier: number;
    fallbackPrice: number;
    coinGeckoId?: string;
}

export const TRACKED_TOKENS: TokenConfig[] = [];

export async function initializeTokens(ctx: ProcessorContext) {
    const { syncedNetwork: network } = ctx
    if (hasInitialized[network as keyof typeof hasInitialized]) {
        return;
    }

    const availableTokens = await tokensService.getNonPoolTokens(ctx, network);

    const missingTokens = TRACKED_TOKENS.filter(token => !availableTokens.some(t => t.symbol === token.symbol));

    if (missingTokens.length === 0) {
        return;
    }

    const tokens = missingTokens.filter(token => token.network === network).map(token => new Token({
        id: getTokenId(token.address.toLowerCase(), network),
        address: token.address.toLowerCase(),
        network,
        name: token.name,
        symbol: token.symbol,
        decimals: token.decimals,
        price: BigDecimal(token.fallbackPrice),
        isPoolToken: false,
        coinGeckoId: token.coinGeckoId ?? '',
        tvlMultiplier: token.tvlMultiplier ?? 1
    }));

    await ctx.store.upsert([...tokens]);
    hasInitialized[network as keyof typeof hasInitialized] = true;
} 
