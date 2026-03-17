import { Network, Token } from '../../model';
import { ProcessorContext } from '../processor';
import { BigDecimal } from '@subsquid/big-decimal';
import { getTokenId } from './helpers';
import { tokensService } from '../../services/tokens';


let hasInitialized = {
    [Network.MAINNET]: false,
    [Network.SEPOLIA]: false,
    [Network.PLUME]: false
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
        symbol: 'pBTC',
        address: '0x427Bb443F2fDa1EF25e261f007662ecab54644Ac',
        name: 'Protos Wrapped BTC',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'pbtc'
    },
    {
        symbol: 'USDT',
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        name: 'Tether USD',
        network: Network.MAINNET,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether'
    },
    {
        symbol: 'WBTC',
        address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
        name: 'Wrapped Bitcoin',
        network: Network.MAINNET,
        decimals: BigInt(8),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'wrapped-bitcoin'
    },
    {
        symbol: 'SolvBTC',
        address: '0x7a56e1c57c7475ccf742a1832b028f0456652f97',
        name: 'Solv.finance BTC',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'solv-btc'
    },
    {
        symbol: 'xSolvBTC',
        address: '0xd9D920AA40f578ab794426F5C90F6C731D159DEf',
        name: 'xSolvBTC',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'solv-protocol-solvbtc-bbn'
    },
    {
        symbol: 'SOL',
        address: '0xd31a59c85ae9d8edefec411d448f90841571b89c',
        name: 'Wrapped SOL',
        network: Network.MAINNET,
        decimals: BigInt(9),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'sol-wormhole'
    },
    {
        symbol: 'wstETH',
        address: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0',
        name: 'Wrapped Lido Staked ETH',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'wrapped-steth'
    },
    {
        symbol: 'WETH',
        address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        name: 'WETH',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'weth'
    },
    {
        symbol: 'sUSDe',
        address: '0x9D39A5DE30e57443BfF2A8307A4256c8797A3497',
        name: 'Ethena sUSDe',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 2,
        fallbackPrice: 1,
        coinGeckoId: 'ethena-staked-usde'
    },
    {
        symbol: 'USDM',
        address: '0x59D9356E565Ab3A36dD77763Fc0d87fEaf85508C',
        name: 'Mountain USDM',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'mountain-protocol-usdm'
    },
    {
        symbol: 'USDX',
        address: '0xf8750b54d86BE7aE9e32b4A0C826811198D63313',
        name: 'Hex USDX',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 3,
        fallbackPrice: 1,
        coinGeckoId: 'hex-trust-usdx'
    },
    {
        symbol: 'USDC',
        address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        name: 'Circle USDC',
        network: Network.MAINNET,
        decimals: BigInt(6),
        tvlMultiplier: 2,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin'
    },
    {
        symbol: 'STONE',
        address: '0x7122985656e38BDC0302Db86685bb972b145bD3C',
        name: 'Stakestone ETH',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'stakestone-ether'
    },
    {
        symbol: 'deUSD',
        address: '0x15700b564ca08d9439c58ca5053166e8317aa138',
        name: 'Elixer deUSD',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'elixir-deusd'
    },
    {
        symbol: 'sdeUSD',
        address: '0x5c5b196abe0d54485975d1ec29617d42d9198326',
        name: 'Staked deUSD',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'elixir-staked-deusd'
    },
    {
        symbol: 'SyrupUSDC',
        address: '0x80ac24aa929eaf5013f6436cda2a7ba190f5cc0b',
        name: 'Syrup USDC',
        network: Network.MAINNET,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'syrupusdc'
    },
    {
        symbol: 'sUSDf',
        address: '0xc8CF6D7991f15525488b2A83Df53468D682Ba4B0',
        name: 'sUSDf',
        network: Network.MAINNET,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'falcon-finance'
    },
    // Plume
    {
        symbol: 'pUSD',
        address: '0xdddD73F5Df1F0DC31373357beAC77545dC5A6f3F',
        name: 'Plume USD',
        network: Network.PLUME,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'plume-usd'
    },
    {
        symbol: 'USDC',
        address: '0x222365EF19F7947e5484218551B56bb3965Aa7aF',
        name: 'USDC',
        network: Network.PLUME,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
    },
    // Base
    {
        symbol: 'USDC',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        name: 'USDC',
        network: Network.BASE,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin'
    },
    {
        symbol: 'USDT',
        address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        name: 'Tether USD',
        network: Network.BASE,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether'
    },
    {
        symbol: 'DAI',
        address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
        name: 'Dai Stablecoin',
        network: Network.BASE,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'dai'
    },
    // Flare
    {
        symbol: 'USDT0',
        address: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
        name: 'USDT0',
        network: Network.FLARE,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether'
    },
    {
        symbol: 'USDCe',
        address: '0xFbDa5F676cB37624f28265A144A48B0d6e87d3b6',
        name: 'Bridged USDC (Stargate)',
        network: Network.FLARE,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin'
    },
    {
        symbol: 'USDX',
        address: '0x4A771Cc1a39FDd8AA08B8EA51F7Fd412e73B3d2B',
        name: 'Hex Trust USD',
        network: Network.FLARE,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'hex-trust-usdx'
    },
    // Sepolia
    {
        symbol: 'WETH',
        address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
        name: 'Wrapped Ether',
        network: Network.SEPOLIA,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'wrapped-ether'
    },
    {
        symbol: 'WETH2',
        address: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
        name: 'Wrapped Ether',
        network: Network.SEPOLIA,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'wrapped-ether'
    },
    {
        symbol: 'wstETH',
        address: '0xb82381a3fbd3fafa77b3a7be693342618240067b',
        name: 'Wrapped Lido Staked ETH',
        network: Network.SEPOLIA,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'wrapped-steth'
    },
    {
        symbol: 'WBTC',
        address: '0x29f2D40B0605204364af54EC677bD022dA425d03',
        name: 'Wrapped Bitcoin',
        network: Network.SEPOLIA,
        decimals: BigInt(8),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'wrapped-bitcoin'
    },
    {
        symbol: 'USDT',
        address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
        name: 'USDT',
        network: Network.SEPOLIA,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'tether'
    },
    {
        symbol: 'DAI',
        address: '0xFF34B3d4Aee8ddCd6F9AFFFB6Fe49bD371b8a357',
        name: 'DAI',
        network: Network.SEPOLIA,
        decimals: BigInt(18),
        tvlMultiplier: 2,
        fallbackPrice: 1,
        coinGeckoId: 'dai'
    },
    {
        symbol: 'USDC',
        address: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8',
        name: 'USDC',
        network: Network.SEPOLIA,
        decimals: BigInt(6),
        tvlMultiplier: 1,
        fallbackPrice: 1,
        coinGeckoId: 'usd-coin'
    },
    {
        symbol: 'AAVE',
        address: '0x88541670E55cC00bEEFD87eB59EDd1b7C511AC9a',
        name: 'AAVE',
        network: Network.SEPOLIA,
        decimals: BigInt(18),
        tvlMultiplier: 1,
        fallbackPrice: 0,
        coinGeckoId: 'aave'
    },
    {
        symbol: 'USDX',
        address: '0x43bd82D1e29a1bEC03AfD11D5a3252779b8c760c',
        name: 'Hex USDX',
        network: Network.SEPOLIA,
        decimals: BigInt(18),
        tvlMultiplier: 2,
        fallbackPrice: 0.95,
        coinGeckoId: 'hex-trust-usdx'
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
