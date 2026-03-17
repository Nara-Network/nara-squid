import { Multicall } from '../../abi/multicall';
import { BigDecimal } from '@subsquid/big-decimal';
import { AbiFunction, FunctionArguments } from '@subsquid/evm-abi';
import { Network, Token } from '../../model';
import { Block, Log, ProcessorContext } from '../processor';

import * as erc20Abi from '../../abi/ERC20';
import { DateTime } from 'luxon';
import { toWei } from './decimal';
import { defineChain } from 'viem';
import { tokensService } from '../../services/tokens';
import { mainnet, sepolia } from 'viem/chains';

// TODO: NEED TO UPDATE! IS THIS JUST SEPOLIA?
export const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const YEAR = BigInt(365 * 24 * 60 * 60);
export const PRIME_YEAR = BigInt(360 * 24 * 60 * 60);
export const DAY = 24 * 60 * 60 * 1000;
export const MAX_VOTE_POWER = BigInt(15e16);
export const MULTIPLIER = BigInt(1e18);
export const OZEANREWARDRATE = BigInt(20e16);
export const MAX_APPROVAL_TIME = 60 * 60 * 1000; // 1hr
export const MAX_FINALIZE_TIME = 7 * DAY;
export type ProcessorProps = {
  ctx: ProcessorContext;
  block: Block;
  log: Log;
  batchSizeMulticall: number;
};

export type AnyFunc = AbiFunction<any, any>;
export type DataInputs<T extends AnyFunc = AnyFunc> = Array<
  [func: T, address: string, args: T extends AnyFunc ? FunctionArguments<T> : never]
>;

export function toEntityMap<E extends { id: string }>(
  entities: E[],
  key: keyof E = 'id'
): Map<string, E> {
  return new Map(entities.map((e) => [(e[key] as any).toString() as string, e]));
}

export function toGroupedEntityMap<E extends { id: string }>(
  entities: E[],
  key: keyof E = 'id'
): Map<string, E[]> {
  return groupBy<string, E>(entities, (e) => (e[key] as any).toString());
}

export function findById<E extends { id: string }>(entity: E[], id: string): E | undefined {
  return entity.find((e) => e.id === id);
}

export function toEntity<E extends { id: string }>(map: Map<string, E[]>): E[] {
  return Array.from(map.values()).reduce((acc, i) => {
    acc.push(...i);
    return acc;
  }, []);
}

export function groupBy<K, V>(array: V[], grouper: (item: V) => K) {
  return array.reduce((store, item) => {
    var key = grouper(item);
    if (!store.has(key)) {
      store.set(key, [item]);
    } else {
      store.get(key)?.push(item);
    }
    return store;
  }, new Map<K, V[]>());
}

export function getOperationId(prefix: string, index: number, hash: string) {
  return `${prefix}-tx_${index}@${hash}`;
}

export function getVirtualOperationId(
  txIndex: number,
  txHash: string,
  account: string,
  index: number = 0
) {
  return `virtual_${txIndex}@${txHash}_${account}_${index}`;
}

export function getBidId(index: number, hash: string) {
  return `${index}@${hash}`;
}

export function getRewardAssetId(asset: string, pool: string) {
  return `${asset}@${pool}`;
}

export function parseRewardAssetId(rewardAssetId: string) {
  return rewardAssetId.split('@');
}

export function getTokenId(asset: string, syncedNetwork: Network) {
  return `${asset}_${syncedNetwork}`;
}

export function getBridgeTokenId(tokenId: string) {
  return `bridge_token_${tokenId}`;
}

export function getTrackerId(syncedNetwork: Network) {
  return `clearpool_change_tracker_${syncedNetwork}`;
}
export function getStakeId(stakeId: string, syncedNetwork: Network, ozean: string = '') {
  return `stake_${stakeId}_${syncedNetwork}${ozean ? `_${ozean}` : ''}`;
}

export async function getCurrencyInfo(
  id: string,
  ctx: ProcessorContext,
  block: Block,
  syncedNetwork: Network
) {
  const contract = new Multicall(ctx, block, MULTICALL_ADDRESS);

  let name = '';
  let symbol = '';
  let decimals = BigInt(6);

  const result = await contract.tryAggregate(
    [
      [erc20Abi.functions.name, id, {}],
      [erc20Abi.functions.decimals, id, {}],
      [erc20Abi.functions.symbol, id, {}],
    ],
    3
  );

  result.forEach((r, i) => {
    if (r.success) {
      switch (i) {
        case 0: {
          name = r.value;
          break;
        }
        case 1: {
          decimals = r.value;
          break;
        }
        case 2: {
          symbol = r.value;
          break;
        }
      }
    }
  });

  const token = await tokensService.getTokenByAddress(ctx, id);

  if (token) {
    return token;
  }

  return new Token({
    id: getTokenId(id, syncedNetwork),
    address: id,
    name: name,
    decimals: decimals,
    symbol: symbol,
    isPoolToken: false,
    price: BigDecimal(1),
    network: syncedNetwork,
    tvlMultiplier: 1
  });
}

export async function getBalance(
  ctx: ProcessorContext,
  block: Block,
  address: string,
  account: string
) {
  const contract = new erc20Abi.Contract(ctx, block, address);
  return contract.balanceOf(account);
}

export function toLocaleString(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('en-us');
}

export function getBatchSizeBasedOnLength(length: number, maxSize: number) {
  const rest = maxSize % length;
  return rest === maxSize ? maxSize : maxSize - rest;
}

export function toDateFormat(timestamp: number) {
  const ts = DateTime.fromMillis(timestamp).toFormat('yyyy-MM-dd');
  return ts;
}

export function toYesterday(timestamp: number) {
  return timestamp - DAY;
}

export const rewardRateToAPR = (
  rate: bigint,
  _totalSupply: bigint,
  poolDecimals: bigint,
  exchangeRate: bigint,
  assetPrice: BigDecimal = BigDecimal(1)
) => {
  if (_totalSupply === BigInt(0) || rate === BigInt(0) || !assetPrice) return BigDecimal(0);

  // Convert totalSupply to 18 decimal places
  const totalSupply = toWei(_totalSupply, Number(poolDecimals.toString()));
  const multiplier = toWei('1', 0);
  const tokenPrice = toWei(assetPrice.toString(), 0);

  const poolSupply =
    exchangeRate > 0
      ? BigDecimal(totalSupply).mul(exchangeRate)
      : BigDecimal(totalSupply).mul(multiplier);
  const usdRewardPerYear = BigDecimal(rate).mul(YEAR).mul(tokenPrice);

  // Calculate APR

  const apr = usdRewardPerYear.mul(multiplier).div(poolSupply);
  return apr;
};

// ozean
export function calcOzeanReward(curentTs: number, lastUpdate: bigint, amount: bigint): BigDecimal {
  let ozeanReward = BigDecimal(0);

  if (lastUpdate !== BigInt(0)) {
    const timeDelta = BigInt(curentTs) - lastUpdate; // in miliseconds
    const apr = OZEANREWARDRATE / YEAR;
    ozeanReward = ozeanReward.add(
      BigDecimal(apr).mul(timeDelta).div(1000).mul(amount).div(MULTIPLIER)
    );
  }
  return ozeanReward;
}

// export const ozean_testnet = defineChain({
//   id: 7849306,
//   name: 'Ozean Testnet',
//   nativeCurrency: {
//     decimals: 18,
//     name: 'USDX',
//     symbol: 'USDX',
//   },
//   rpcUrls: {
//     default: { http: ['https://ozean-testnet.rpc.caldera.xyz/http'] },
//   },
//   blockExplorers: {
//     default: {
//       name: 'Ozean Testnet explorer',
//       url: 'https://ozean-testnet.explorer.caldera.xyz/',
//       apiUrl: 'https://ozean-testnet.explorer.caldera.xyz/api/v2/',
//     },
//   },
//   contracts: {
//     multicall3: {
//       address: '0xca11bde05977b3631167028862be2a173976ca11',
//       blockCreated: 1802407,
//     },
//   },
//   testnet: true,
// });

export const poseidon_testnet = defineChain({
  id: 31911,
  name: 'Poseidon Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['https://poseidon-testnet.rpc.caldera.xyz/http'] },
  },
  blockExplorers: {
    default: {
      name: 'Ozean Testnet explorer',
      url: 'https://poseidon-testnet.explorer.caldera.xyz/',
      apiUrl: 'https://poseidon-testnet.explorer.caldera.xyz/api/v2/',
    },
  },
  contracts: {
    multicall3: {
      address: '0xca11bde05977b3631167028862be2a173976ca11', // TODO: NEED TO UPDATE!
      blockCreated: 1802407,
    },
  },
  testnet: true,
});

export const SupportedChainIds = [poseidon_testnet.id, sepolia.id, mainnet.id] as const;
export type SupportedChainId = typeof SupportedChainIds[number];