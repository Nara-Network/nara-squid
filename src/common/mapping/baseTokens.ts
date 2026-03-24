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

export const TRACKED_TOKENS: TokenConfig[] = [
    {
        symbol: 'NaraUSD',
        address: '0xB2c2Ee3059cDA930c3f25cc9C1aefffcE905ec85',
        name: 'NaraUSD',
        network: Network.ARBITRUM,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD3',
        address: '0x765e199aC49BFA8E1Be071c23FAAc93C2906821D',
        name: 'NaraUSD3',
        network: Network.ARBITRUM,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD+',
        address: '0x1095fBe2A83D76e44d49B25520B34Ee6168Be309',
        name: 'NaraUSD+',
        network: Network.ARBITRUM,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'USDC',
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        name: 'USD Coin',
        network: Network.ARBITRUM,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin',
    },
    {
        symbol: 'USDT',
        address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
        name: 'Tether USD',
        network: Network.ARBITRUM,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether',
    },
    {
        symbol: 'NaraUSD',
        address: '0x8edde47955949B96F5aCcA75404615104EAb84aF',
        name: 'NaraUSD',
        network: Network.ARBITRUM_SEPOLIA,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD3',
        address: '0x765e199aC49BFA8E1Be071c23FAAc93C2906821D',
        name: 'NaraUSD3',
        network: Network.ARBITRUM_SEPOLIA,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'NaraUSD+',
        address: '0x96385414E9913a1184c5e728E473fe79e508C44E',
        name: 'NaraUSD+',
        network: Network.ARBITRUM_SEPOLIA,
        decimals: 18n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    {
        symbol: 'USDC',
        address: '0x3253a335E7bFfB4790Aa4C25C4250d206E9b9773',
        name: 'USD Coin',
        network: Network.ARBITRUM_SEPOLIA,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin',
    },
    {
        symbol: 'USDT',
        address: '0x095f40616FA98Ff75D1a7D0c68685c5ef806f110',
        name: 'Tether USD',
        network: Network.ARBITRUM_SEPOLIA,
        decimals: 6n,
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether',
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
