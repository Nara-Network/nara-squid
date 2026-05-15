import { Network, Token } from '../../model';
import { ProcessorContext } from '../dataSet';
import { BigDecimal } from '@subsquid/big-decimal';
import { getTokenId } from './helpers';
import { tokensService } from '../../services/tokens';


let hasInitialized = {
    [Network.ETHEREUM]: false,
    [Network.ETHEREUM_SEPOLIA]: false,
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

export const TRACKED_TOKENS: TokenConfig[] = [
    {
        symbol: 'NaraUSD',
        address: '0x5C6263904CCFD3Bcf1aAa6e7063dDd29743b3Bb7',
        name: 'NaraUSD',
        network: Network.ETHEREUM,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD3',
        address: '0x765e199aC49BFA8E1Be071c23FAAc93C2906821D',
        name: 'NaraUSD3',
        network: Network.ETHEREUM,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD+',
        address: '0x1aa23CDFC941f6b54251C72012A9Bfa4bF5394D6',
        name: 'NaraUSD+',
        network: Network.ETHEREUM,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'USDC',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        name: 'USD Coin',
        network: Network.ETHEREUM,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin',
    },
    {
        symbol: 'USDT',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'Tether USD',
        network: Network.ETHEREUM,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether',
    },
    {
        symbol: 'USDC',
        address: '0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590',
        name: 'USD Coin',
        network: Network.ETHEREUM_SEPOLIA,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin',
    },
    {
        symbol: 'USDT',
        address: '0xF3F2b4815A58152c9BE53250275e8211163268BA',
        name: 'Tether USD',
        network: Network.ETHEREUM_SEPOLIA,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin',
    },
        {
        symbol: 'NaraUSD',
        address: '0x0e26A4E2dCb28796E3088345B6bAc3D46192bF17',
        name: 'NaraUSD',
        network: Network.ETHEREUM_SEPOLIA,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD+',
        address: '0xfe3D71E78D58503c82559357fBdE52863B5969dc',
        name: 'NaraUSD',
        network: Network.ETHEREUM_SEPOLIA,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
];

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

export function getTrackedTokenAddress(network: Network, symbol: string): string | undefined {
    return TRACKED_TOKENS.find(
        (token) => token.network === network && token.symbol === symbol
    )?.address.toLowerCase();
}
