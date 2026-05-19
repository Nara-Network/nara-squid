import { startOfDay, isEqual } from 'date-fns'
import { Network } from '../model';
import { ProcessorContext } from '../common/dataSet';
import { AbiFunction, FunctionArguments, FunctionReturn } from '@subsquid/evm-abi';
import { BigDecimal } from '@subsquid/big-decimal';
import { parseUnits } from 'viem';
import { tokensService } from '../services/tokens';

// In-memory cache for token decimals
const TOKEN_DECIMALS_CACHE = new Map<string, number>();
const DEFAULT_CONTRACT_CALL_MAX_RETRIES = 5;
const DEFAULT_CONTRACT_CALL_RETRY_DELAY_MS = 3_000;
const DEFAULT_CONTRACT_CALL_MAX_RETRY_MS = 30_000;

type ContractCallDiagnostics = {
  rpcHead?: number;
  targetBlockAvailable?: boolean;
  diagnosticsError?: string;
};

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getBooleanEnv(name: string): boolean {
  return process.env[name]?.toLowerCase() === 'true';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getRpcErrorCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error
    ? (error as { code?: unknown }).code
    : undefined;
}

function isRetryableRpcError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  const code = getRpcErrorCode(error);
  return (
    message.includes('header not found') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('missing trie node') ||
    code === 429
  );
}

function getBatchBounds(ctx: ProcessorContext): { firstBlock?: number; lastBlock?: number } {
  const firstBlock = ctx.blocks[0]?.header.height;
  const lastBlock = ctx.blocks[ctx.blocks.length - 1]?.header.height;
  return { firstBlock, lastBlock };
}

async function getContractCallDiagnostics(
  ctx: ProcessorContext,
  targetBlock: number
): Promise<ContractCallDiagnostics> {
  try {
    const [rpcHeadHex, targetBlockData] = await Promise.all([
      ctx._chain.client.call('eth_blockNumber', []),
      ctx._chain.client.call('eth_getBlockByNumber', [
        '0x' + targetBlock.toString(16),
        false,
      ]),
    ]);
    return {
      rpcHead: Number.parseInt(rpcHeadHex, 16),
      targetBlockAvailable: targetBlockData != null,
    };
  } catch (error) {
    return {
      diagnosticsError: getErrorMessage(error),
    };
  }
}

function logContractCallRetry(params: {
  ctx: ProcessorContext;
  contract: string;
  functionName: string;
  targetBlock: number;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  error: unknown;
  diagnostics: ContractCallDiagnostics;
}) {
  const { firstBlock, lastBlock } = getBatchBounds(params.ctx);
  console.warn('[contract-call-retry]', {
    network: params.ctx.syncedNetwork,
    contract: params.contract.toLowerCase(),
    functionName: params.functionName,
    targetBlock: params.targetBlock,
    batchFirstBlock: firstBlock,
    batchLastBlock: lastBlock,
    isHead: params.ctx.isHead,
    attempt: params.attempt,
    maxRetries: params.maxRetries,
    retryInMs: params.delayMs,
    rpcHead: params.diagnostics.rpcHead,
    rpcLagBlocks:
      params.diagnostics.rpcHead === undefined
        ? undefined
        : params.targetBlock - params.diagnostics.rpcHead,
    targetBlockAvailable: params.diagnostics.targetBlockAvailable,
    diagnosticsError: params.diagnostics.diagnosticsError,
    rpcErrorCode: getRpcErrorCode(params.error),
    rpcErrorMessage: getErrorMessage(params.error),
  });
}

function buildContractCallError(params: {
  ctx: ProcessorContext;
  contract: string;
  functionName: string;
  targetBlock: number;
  attempts: number;
  elapsedMs: number;
  error: unknown;
  diagnostics: ContractCallDiagnostics;
}): Error {
  const { firstBlock, lastBlock } = getBatchBounds(params.ctx);
  return new Error(
    [
      `Contract call failed after ${params.attempts} attempt(s) and ${params.elapsedMs}ms`,
      `network=${params.ctx.syncedNetwork}`,
      `contract=${params.contract.toLowerCase()}`,
      `function=${params.functionName}`,
      `targetBlock=${params.targetBlock}`,
      `batch=${firstBlock ?? 'unknown'}-${lastBlock ?? 'unknown'}`,
      `isHead=${params.ctx.isHead}`,
      `rpcHead=${params.diagnostics.rpcHead ?? 'unknown'}`,
      `targetBlockAvailable=${params.diagnostics.targetBlockAvailable ?? 'unknown'}`,
      `rpcErrorCode=${String(getRpcErrorCode(params.error) ?? 'unknown')}`,
      `rpcErrorMessage=${getErrorMessage(params.error)}`,
    ].join(' '),
  );
}

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
  return network === Network.ETHEREUM_SEPOLIA;
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

  const maxRetries = getPositiveIntegerEnv(
    'CONTRACT_CALL_MAX_RETRIES',
    DEFAULT_CONTRACT_CALL_MAX_RETRIES,
  );
  const retryDelayMs = getPositiveIntegerEnv(
    'CONTRACT_CALL_RETRY_DELAY_MS',
    DEFAULT_CONTRACT_CALL_RETRY_DELAY_MS,
  );
  const maxRetryMs = getPositiveIntegerEnv(
    'CONTRACT_CALL_MAX_RETRY_MS',
    DEFAULT_CONTRACT_CALL_MAX_RETRY_MS,
  );
  const shouldLogRetries = getBooleanEnv('CONTRACT_CALL_LOG_RETRIES');
  const startedAt = Date.now();
  let lastDiagnostics: ContractCallDiagnostics = {};

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await ctx._chain.client.call('eth_call', [
        { to: contract, data },
        '0x' + targetBlock.toString(16)
      ]);

      // Check if result is empty or indicates failure
      if (!result || result === '0x' || result === '0x0') {
        console.warn('[contract-call-empty-result]', {
          network: ctx.syncedNetwork,
          contract: contract.toLowerCase(),
          functionName: String(functionName),
          targetBlock,
          isHead: ctx.isHead,
        });
        throw new Error(`Contract call failed or returned empty result for function ${String(functionName)} on contract ${contract} at block ${targetBlock}`);
      }

      return func.decodeResult(result) as FunctionReturn<T['functions'][K]>;
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;
      const hasAttemptsLeft = attempt <= maxRetries;
      const hasTimeLeft = elapsedMs + retryDelayMs <= maxRetryMs;
      const shouldRetry =
        hasAttemptsLeft && hasTimeLeft && isRetryableRpcError(error);

      lastDiagnostics =
        !shouldRetry || shouldLogRetries
          ? await getContractCallDiagnostics(ctx, targetBlock)
          : {};

      if (!shouldRetry) {
        const enrichedError = buildContractCallError({
          ctx,
          contract,
          functionName: String(functionName),
          targetBlock,
          attempts: attempt,
          elapsedMs,
          error,
          diagnostics: lastDiagnostics,
        });
        console.error('[contract-call-failed]', enrichedError.message);
        throw enrichedError;
      }

      if (shouldLogRetries) {
        logContractCallRetry({
          ctx,
          contract,
          functionName: String(functionName),
          targetBlock,
          attempt,
          maxRetries,
          delayMs: retryDelayMs,
          error,
          diagnostics: lastDiagnostics,
        });
      }
      await sleep(retryDelayMs);
    }
  }

  throw new Error(
    `Contract call retry loop exited unexpectedly for function ${String(functionName)} on contract ${contract} at block ${targetBlock}`,
  );
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
