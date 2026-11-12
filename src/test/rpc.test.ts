import assert from 'node:assert/strict';
import http from 'http';
import { AddressInfo } from 'net';
import { HttpClient } from '@subsquid/http-client';
import { HEAD_LAG_DELAYS_MS, PORTAL_HTTP_RETRY, createRpcClient, isHeadLagError, retryHeadLag } from '../common/rpc';
import { DEFAULT_CONTRACT_CALL_MAX_RETRY_MS, isRetryableRpcError } from '../helpers/common';

type Reply = { status?: number; body: unknown };

/** JSON-RPC server that answers each request with the next scripted reply. */
async function scriptedRpc(replies: Reply[]) {
  const seen: string[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const call = JSON.parse(raw);
      seen.push(call.method);
      const reply = replies.shift() ?? { body: null };
      res.writeHead(reply.status ?? 200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(reply.status ? { error: 'rate limited' } : { jsonrpc: '2.0', id: call.id, ...(reply.body as object) }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, seen, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

describe('isHeadLagError', () => {
  it('matches the node-behind-the-Portal errors seen in prod', () => {
    assert.equal(isHeadLagError(new Error('block not found: 0x192ba72')), true);
    assert.equal(isHeadLagError(new Error('header not found')), true);
  });

  it('does not match a revert', () => {
    assert.equal(isHeadLagError(new Error('execution reverted')), false);
  });
});

describe('isRetryableRpcError', () => {
  it('retries an HTTP 429 from the http client, which carries no RPC code', () => {
    assert.equal(isRetryableRpcError(new Error('Got 429 from https://mainnet.gateway.tenderly.co/')), true);
    assert.equal(isRetryableRpcError(new Error('Got 503 from https://example.org/')), true);
  });

  it('retries block not found', () => {
    assert.equal(isRetryableRpcError(new Error('block not found: 0x192b93b')), true);
  });

  it('does not retry a revert or a 400', () => {
    assert.equal(isRetryableRpcError(new Error('execution reverted')), false);
    assert.equal(isRetryableRpcError(new Error('Got 400 from https://example.org/')), false);
  });
});

describe('retryHeadLag', () => {
  it('retries head-lag errors until the call succeeds', async () => {
    let calls = 0;
    const result = await retryHeadLag(async () => {
      calls++;
      if (calls < 3) throw new Error('block not found: 0x1');
      return 'ok';
    }, undefined, [0, 0, 0]);
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
  });

  it('throws other errors at once', async () => {
    let calls = 0;
    const err = await retryHeadLag(async () => {
      calls++;
      throw new Error('execution reverted');
    }, undefined, [0, 0, 0]).catch((e) => e);
    assert.equal(err.message, 'execution reverted');
    assert.equal(calls, 1);
  });

  it('gives up after the last delay', async () => {
    let calls = 0;
    const err = await retryHeadLag(async () => {
      calls++;
      throw new Error('block not found: 0x1');
    }, undefined, [0, 0]).catch((e) => e);
    assert.equal(err.message, 'block not found: 0x1');
    assert.equal(calls, 3);
  });

  it('retries a not-ready result and returns it once delays run out', async () => {
    let calls = 0;
    const result = await retryHeadLag(async () => {
      calls++;
      return null;
    }, (r) => r == null, [0, 0]);
    assert.equal(result, null);
    assert.equal(calls, 3);
  });
});

describe('createRpcClient against a JSON-RPC server', function () {
  this.timeout(20_000);

  it('rides out a 429, then a block-not-found, on one eth_call', async () => {
    const rpc = await scriptedRpc([
      { status: 429, body: null },
      { body: { error: { code: -32001, message: 'block not found: 0x192ba72' } } },
      { body: { result: '0x2a' } },
    ]);
    const client = createRpcClient(rpc.url);
    try {
      const result = await client.call('eth_call', [{ to: '0x0', data: '0x' }, '0x192ba72']);
      assert.equal(result, '0x2a');
      assert.deepEqual(rpc.seen, ['eth_call', 'eth_call', 'eth_call']);
    } finally {
      client.close();
      await rpc.close();
    }
  });

  it('waits for a block the node has not imported yet', async () => {
    const rpc = await scriptedRpc([{ body: { result: null } }, { body: { result: { timestamp: '0x10' } } }]);
    const client = createRpcClient(rpc.url);
    try {
      const block = await client.call('eth_getBlockByNumber', ['0x192ba72', false]);
      assert.deepEqual(block, { timestamp: '0x10' });
    } finally {
      client.close();
      await rpc.close();
    }
  });

  it('does not retry a revert', async () => {
    const rpc = await scriptedRpc([{ body: { error: { code: 3, message: 'execution reverted' } } }, { body: { result: '0x2a' } }]);
    const client = createRpcClient(rpc.url);
    try {
      const err = await client.call('eth_call', [{ to: '0x0', data: '0x' }, 'latest']).catch((e) => e);
      assert.match(String(err.message), /execution reverted/);
      assert.equal(rpc.seen.length, 1);
    } finally {
      client.close();
      await rpc.close();
    }
  });
});

describe('getRpcUrl', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    delete require.cache[require.resolve('../common/types')];
  });

  it('prefers the SQD RPC addon over Ankr when the slot declares it', () => {
    delete process.env.RPC_URL_ETHEREUM;
    process.env.RPC_ETH_HTTP = 'http://rpc-addon.example/eth';
    delete require.cache[require.resolve('../common/types')];
    const { getRpcUrl } = require('../common/types');
    assert.equal(getRpcUrl('ETHEREUM'), 'http://rpc-addon.example/eth');
  });

  it('lets RPC_URL_<NETWORK> override the addon', () => {
    process.env.RPC_ETH_HTTP = 'http://rpc-addon.example/eth';
    process.env.RPC_URL_ETHEREUM = 'http://override.example';
    delete require.cache[require.resolve('../common/types')];
    const { getRpcUrl } = require('../common/types');
    assert.equal(getRpcUrl('ETHEREUM').url, 'http://override.example');
  });
});

describe('PORTAL_HTTP_RETRY', function () {
  this.timeout(10_000);

  it('makes the portal HttpClient survive a connection reset', async () => {
    let requests = 0;
    const server = http.createServer((req, res) => {
      requests++;
      if (requests % 2 === 1) {
        req.socket.destroy(); // ECONNRESET on the client, as the Portal did in prod
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"number":1}');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/head`;
    try {
      const res = await new HttpClient(PORTAL_HTTP_RETRY).get(url);
      assert.deepEqual(res, { number: 1 });
      assert.equal(requests, 2);
      const err = await new HttpClient({}).get(url).catch((e: Error) => e);
      assert.ok(err instanceof Error, 'without retries the reset is fatal');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('readContract retry budget', () => {
  it('leaves room for a second attempt after the client waits out head lag', () => {
    // 12 Nov: Sepolia's node sat one block behind for 32 s; the client's head-lag wait used the whole 30 s
    // budget, readContract gave up after 1 attempt and the processor restarted.
    const oneAttemptMs = HEAD_LAG_DELAYS_MS.reduce((a, b) => a + b, 0);
    assert.ok(DEFAULT_CONTRACT_CALL_MAX_RETRY_MS >= 3 * oneAttemptMs, `${DEFAULT_CONTRACT_CALL_MAX_RETRY_MS} vs ${oneAttemptMs} per attempt`);
  });
});
