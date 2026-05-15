import { run } from '@subsquid/batch-processor';
import { augmentBlock } from '@subsquid/evm-objects';
import { createLogger } from '@subsquid/logger';
import { RpcClient } from '@subsquid/rpc-client';
import { generatePortalDataSet } from '../common/dataSet';
import { logsDataSetParser } from '../common/generate';
import { getRpcUrl } from '../common/types';
import { Network } from '../model';
import configurator from './config';

const dataSet = generatePortalDataSet(configurator);
const logger = createLogger('sqd:data-set:mapping');
const rpcConfig = getRpcUrl(Network.ETHEREUM_SEPOLIA);
const rpcClient = new RpcClient({
  url: typeof rpcConfig === 'string' ? rpcConfig : rpcConfig.url,
  rateLimit: typeof rpcConfig === 'string' ? undefined : rpcConfig.rateLimit,
  maxBatchCallSize:
    typeof rpcConfig === 'string' ? undefined : rpcConfig.maxBatchCallSize,
  requestTimeout: 20_000,
  retryAttempts: 3,
});

const { db, parser } = logsDataSetParser(configurator);

run(dataSet, db, async (simpleCtx) => {
  const ctx = {
    ...simpleCtx,
    blocks: simpleCtx.blocks.map(augmentBlock),
    log: logger,
    _chain: {
      client: rpcClient,
    },
  };
  await parser(ctx);
});
