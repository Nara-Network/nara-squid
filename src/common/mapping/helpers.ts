import { Multicall } from '../../abi/multicall';
import { BigDecimal } from '@subsquid/big-decimal';
import { AbiFunction, FunctionArguments } from '@subsquid/evm-abi';
import { Network, Token } from '../../model';
import { Block, Log, ProcessorContext } from '../processor';

import * as erc20Abi from '../../abi/ERC20';
import { DateTime } from 'luxon';
import { toWei } from './decimal';
import { tokensService } from '../../services/tokens';
import { arbitrum, arbitrumSepolia } from 'viem/chains';

// TODO: NEED TO UPDATE! IS THIS JUST SEPOLIA?
export const MULTICALL_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
export const YEAR = BigInt(365 * 24 * 60 * 60);
export const PRIME_YEAR = BigInt(360 * 24 * 60 * 60);
export const DAY = 24 * 60 * 60 * 1000;
export const MAX_VOTE_POWER = BigInt(15e16);
export const MULTIPLIER = BigInt(1e18);
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

export function getTokenId(asset: string, syncedNetwork: Network) {
  return `${asset}_${syncedNetwork}`;
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

export const SupportedChainIds = [arbitrumSepolia.id, arbitrum.id] as const;
export type SupportedChainId = typeof SupportedChainIds[number];
