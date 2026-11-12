import { RpcClient } from '@subsquid/rpc-client';

export type RpcEndpoint = string | { url: string; rateLimit?: number; maxBatchCallSize?: number };

// The Portal can deliver a block before the RPC node has imported it. Calls at that
// height fail for a few seconds with one of these, then succeed.
const HEAD_LAG_ERROR = /block not found|header not found|unknown block|cannot query unfinalized data|after last accepted block/i;

// Delays between retries of a head-lag failure (~31 s in total).
const HEAD_LAG_DELAYS_MS = [500, 1_000, 2_000, 3_000, 5_000, 8_000, 12_000];

// Transport failures (429, 408, 502-504, timeouts, resets) are retried by RpcClient
// itself. Its default of 0 retries on a 10/100/500 ms schedule gave up within a second
// against a rate-limited gateway and crashed the processor.
const TRANSPORT_RETRY_ATTEMPTS = 20;
const TRANSPORT_RETRY_SCHEDULE_MS = [500, 1_000, 2_000, 5_000, 10_000, 20_000];

export function isHeadLagError(error: unknown): boolean {
  return error instanceof Error && HEAD_LAG_ERROR.test(error.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `attempt` until it succeeds, retrying head-lag failures. `isNotReady` marks a
 * successful result that still means the node is behind (a null block).
 */
export async function retryHeadLag<T>(
  attempt: () => Promise<T>,
  isNotReady: (result: T) => boolean = () => false,
  delaysMs: readonly number[] = HEAD_LAG_DELAYS_MS,
): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const result = await attempt();
      if (i >= delaysMs.length || !isNotReady(result)) return result;
    } catch (error) {
      if (i >= delaysMs.length || !isHeadLagError(error)) throw error;
    }
    await sleep(delaysMs[i]);
  }
}

function isMissingBlock(method: string, result: unknown): boolean {
  return (method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') && result == null;
}

/** RpcClient that also waits out the node lagging behind the Portal head. */
export class HeadLagTolerantRpcClient extends RpcClient {
  override call<T = any>(method: string, params?: any[], options?: any): Promise<T> {
    return retryHeadLag(
      () => super.call<T>(method, params, options),
      (result) => isMissingBlock(method, result),
    );
  }

  override batchCall<T = any>(batch: { method: string; params?: any[] }[], options?: any): Promise<T[]> {
    return retryHeadLag(
      () => super.batchCall<T>(batch, options),
      (results) => results.some((r, i) => isMissingBlock(batch[i].method, r)),
    );
  }
}

export function createRpcClient(endpoint: RpcEndpoint): RpcClient {
  return new HeadLagTolerantRpcClient({
    url: typeof endpoint === 'string' ? endpoint : endpoint.url,
    rateLimit: typeof endpoint === 'string' ? undefined : endpoint.rateLimit,
    maxBatchCallSize: typeof endpoint === 'string' ? undefined : endpoint.maxBatchCallSize,
    requestTimeout: 20_000,
    retryAttempts: TRANSPORT_RETRY_ATTEMPTS,
    retrySchedule: TRANSPORT_RETRY_SCHEDULE_MS,
  });
}
