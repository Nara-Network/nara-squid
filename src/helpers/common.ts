import { startOfDay, isEqual } from 'date-fns'
import { Network } from '../model';
import { ProcessorContext } from '../common/processor';
import { AbiFunction, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi';
import { BigDecimal } from '@subsquid/big-decimal';
import { parseUnits } from 'viem';
import { tokensService } from '../services/tokens';

// In-memory cache for token decimals
const TOKEN_DECIMALS_CACHE = new Map<string, number>();

export function getStartOfDay(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export function getPreviousStartOfDay(timestamp: number): Date {
  const date = new Date(timestamp);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - 1);
  return date;
}


export function isSameDayUTC(dateLeft: Date, dateRight: Date): boolean {
  const d1 = new Date(Date.UTC(dateLeft.getUTCFullYear(), dateLeft.getUTCMonth(), dateLeft.getUTCDate()));
  const d2 = new Date(Date.UTC(dateRight.getUTCFullYear(), dateRight.getUTCMonth(), dateRight.getUTCDate()));
  return isEqual(startOfDay(d1), startOfDay(d2));
}

export function hasMinutesPassed(dateLeft: Date, dateRight: Date, minutes: number): boolean {
  const diffInMs = Math.abs(dateRight.getTime() - dateLeft.getTime());
  const diffInMinutes = diffInMs / (1000 * 60);
  return diffInMinutes >= minutes;
}

export function hasPassedMinutesUTC(dateLeftUTC: Date, dateRightUTC: Date, minutes: number): boolean {
  const diffInMs = Math.abs(dateRightUTC.getTime() - dateLeftUTC.getTime());
  const diffInMinutes = diffInMs / (1000 * 60);
  return diffInMinutes >= minutes;
}

export function isTestnet(network: Network): boolean {
  return network === Network.SEPOLIA;
}

export async function readContract<T extends { functions: { [key: string]: AbiFunction<any, any> } }, K extends string>(
  ctx: ProcessorContext, 
  contract: string,
  contractAbi: T,
  functionName: K & keyof T['functions'],
  args: FunctionArguments<T['functions'][K]>,
  blockHeight?: number
): Promise<FunctionReturn<T['functions'][K]>> {
  const func = contractAbi.functions[functionName];
  if (!func) {
    throw new Error(`Function ${String(functionName)} not found in contract ABI`);
  }
  const data = func.encode(args);
  
  // Use provided block height or fall back to the last block in the batch
  const targetBlock = blockHeight || ctx.blocks[ctx.blocks.length - 1].header.height;
  
  try {
    const result = await ctx._chain.client.call('eth_call', [
      { to: contract, data },
      '0x' + targetBlock.toString(16)
    ]);
    
    // Check if result is empty or indicates failure
    if (!result || result === '0x' || result === '0x0') {
      console.warn(`Contract call returned empty result for function ${String(functionName)} on contract ${contract} at block ${targetBlock}`);
      throw new Error(`Contract call failed or returned empty result for function ${String(functionName)} on contract ${contract} at block ${targetBlock}`);
    }
    
    return func.decodeResult(result) as FunctionReturn<T['functions'][K]>;
  } catch (error) {
    console.error(`Error calling function ${String(functionName)} on contract ${contract} at block ${targetBlock}:`, error);
    throw error;
  }
}

export function convertToBaseTokenAmount(amount: bigint, baseDecimals: bigint, tokenDecimals: bigint): bigint {
  if(baseDecimals == tokenDecimals) {
    return amount;
  }

  if (tokenDecimals < baseDecimals) {
    return amount * (10n ** (baseDecimals - tokenDecimals));
  }
  
  return amount / (10n ** (tokenDecimals - baseDecimals));
}

export function calculateUsdPriceInBN(amount: bigint, price: BigDecimal, baseDecimals: bigint): bigint {
  const priceBN = parseUnits(price.toString(), Number(baseDecimals));
  return priceBN * amount / BigInt(10 ** Number(baseDecimals));
}

/**
 * Normalize an amount from one decimal precision to another.
 * 
 * @param amountRaw - The raw amount in fromDec precision
 * @param fromDec - Source decimal precision
 * @param toDec - Target decimal precision
 * @returns Amount normalized to toDec precision (floor for scale down)
 */
export function normalizeDecimals(amountRaw: bigint, fromDec: number, toDec: number): bigint {
  if (fromDec === toDec) return amountRaw;
  if (amountRaw === 0n) return 0n;
  
  if (toDec > fromDec) {
    // Scale up: multiply by 10^(toDec - fromDec)
    return amountRaw * (10n ** BigInt(toDec - fromDec));
  } else {
    // Scale down: divide by 10^(fromDec - toDec) (floor)
    return amountRaw / (10n ** BigInt(fromDec - toDec));
  }
}

/**
 * Clamp a value to zero if negative.
 */
export function clampToZero(x: bigint): bigint {
  return x < 0n ? 0n : x;
}

/**
 * Get token decimals with in-memory caching.
 * Uses tokensService.getTokenByAddress to fetch token and get decimals.
 */
export async function getTokenDecimalsCached(
  ctx: ProcessorContext,
  tokenAddr: string
): Promise<number> {
  const addrLower = tokenAddr.toLowerCase();
  
  // Check in-memory cache first
  if (TOKEN_DECIMALS_CACHE.has(addrLower)) {
    return TOKEN_DECIMALS_CACHE.get(addrLower)!;
  }
  
  // Try to get token from tokensService
  const token = await tokensService.getTokenByAddress(ctx, addrLower);
  if (token) {
    const dec = Number(token.decimals);
    TOKEN_DECIMALS_CACHE.set(addrLower, dec);
    return dec;
  }
  
  // If token not found, log warning and default to 18 decimals
  ctx.log.warn(`[TOKEN DECIMALS] Token not found for ${tokenAddr}, defaulting to 18 decimals`);
  TOKEN_DECIMALS_CACHE.set(addrLower, 18);
  return 18;
}