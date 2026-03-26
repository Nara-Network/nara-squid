import { GatewaySettings, RpcEndpointSettings } from '@subsquid/evm-processor';
import { assertNotNull } from '@subsquid/util-internal';
import { Network } from '../model';

export type Strategy = {
  address: string;
  asset: string;
  block: number;
};

// NOTE: CommitmentFeeTier type removed - commitment fee is now hard-coded (see getCommitmentFeeRateBps in eer.ts)

export type ExpectedExchangeRateConfig = {
  borrower: string;  // wallet that receives drawdowns and sends repayments
  assets: string[];  // ERC20 token addresses managed by the vault (stables); includes base + others
  borrowRateBps: number;  // annual borrow rate in basis points (e.g. 1200 = 12%)
  // NOTE: commitmentFeeTiers removed - commitment fee is now hard-coded (see getCommitmentFeeRateBps in eer.ts)
  eerDebug?: boolean;  // enable detailed EER debug logging for this vault (default: false)
}

// Vault with optional EER config
export type VaultWithEERConfig = Vault & {
  expectedExchangeRateConfig?: ExpectedExchangeRateConfig;
}

export type NaraReserveFundSource = {
  wallet: string;
  tokenSymbol: string;
};

export type NaraInvestmentVaultSource = {
  vaultAddress: string;
  tokenAddress?: string;
};

export type Config = {
  startBlock: number;
  Nara?: {
    ReserveFund?: string;
    Investments?: string;
  } | null;
  Port?: {
    Vaults: VaultWithEERConfig[];
    Strategies?: {
      AAVE?: Strategy;
      COMPOUND?: Strategy;
      CLEARPOOL?: (Strategy & { AtomicQueue: string })[];
    };
    EER_MODE?: 'hourly_simple_no_diversion' | 'legacy';
  } | null
};

export type ContractConfig = {
  address: string;
  block: number;
};

export type Vault = ContractConfig & {
  Teller: string;
  Accountant: string;
  AtomicQueue: string;
  AtomicSolver: string;
  RolesAuthority: string;
  Manager: string;
  StartApyCalculationTimestamp?: number;
}

export type Configurator = {
  rpc: { archive?: GatewaySettings | string; chain: RpcEndpointSettings | string };
  network: Network;
  configFile: Config;
  startBlock: number;
  storeName: string;
  finalityConfirmations: number;
  syncedBlocksInterval: number;
  batchSizeMulticall: number;
  poolSizeDelayTs: number;
};

export const squidStoreNames: Record<string, string> = {
  ARBITRUM: 'arbitrum_processor',
  ARBITRUM_SEPOLIA: 'arbitrum_sepolia_processor'
};

const ankrSlugByNetwork = {
  ARBITRUM: 'arbitrum',
  ARBITRUM_SEPOLIA: 'arbitrum_sepolia'
};

const alchemySlugByNetwork = {
  ARBITRUM: 'arb-mainnet',
  ARBITRUM_SEPOLIA: 'arb-sepolia'
};

const squidSlugByNetwork = {
  ARBITRUM: process.env.RPC_ARBITRUM_HTTP,
  ARBITRUM_SEPOLIA: process.env.RPC_ARBITRUM_SEPOLIA_HTTP
};

const alchemyFallbacks = JSON.parse(process.env.ALCHEMY_FALLBACK_NETWORKS || '[]'); // unique key
const blastFallbacks = JSON.parse(process.env.BLAST_FALLBACK_NETWORKS || '[]'); // common api key
const squidFallbacks = JSON.parse(process.env.SQUID_FALLBACK_NETWORKS || '[]'); // common key

const blastApiKey = process.env.BLAST_API_KEY;
const ankrApiKey = process.env.ANKR_API_KEY!;
const arbitrumApiKey = process.env.ANKR_API_KEY_ARBITRUM || process.env.ARBITRUM_API_KEY;

function getAnkrApiKey(network: Network): string {
  if (network === Network.ARBITRUM || network === Network.ARBITRUM_SEPOLIA) {
    return arbitrumApiKey ?? ankrApiKey;
  }
  return ankrApiKey;
}

export const getRpcUrl = (network: Network, fallbackKey?: any): string | RpcEndpointSettings => {
  if (alchemyFallbacks.includes(network) && fallbackKey) {
    return {
      url: `https://${alchemySlugByNetwork[network as keyof typeof alchemySlugByNetwork]}.g.alchemy.com/v2/${fallbackKey}`,
      rateLimit: undefined,
      maxBatchCallSize: 1000,
    };
  } else if (squidFallbacks.includes(network)) {
    return assertNotNull(
      squidSlugByNetwork[network as keyof typeof squidSlugByNetwork],
      `Required env variable for ${network} network is missing`
    );
  }
  return {
    url: `https://rpc.ankr.com/${ankrSlugByNetwork[network as keyof typeof ankrSlugByNetwork]}/${getAnkrApiKey(network)}`,
    rateLimit: 100,
    maxBatchCallSize: 1000,
  };
};

const MINUTE = 60;

export const poolSizeDelayByNetwork = {
  ARBITRUM: MINUTE,
  ARBITRUM_SEPOLIA: MINUTE,
};
