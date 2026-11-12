import { run } from '@subsquid/batch-processor';
import { augmentBlock } from '@subsquid/evm-objects';
import { createLogger } from '@subsquid/logger';
import { generatePortalDataSet } from '../common/dataSet';
import { createRpcClient } from '../common/rpc';
import { logsDataSetParser } from '../common/generate';
import { getRpcUrl } from '../common/types';
import { Network } from '../model';
import configurator from './config';

const dataSet = generatePortalDataSet(configurator);
const logger = createLogger('sqd:data-set:mapping');
const rpcClient = createRpcClient(getRpcUrl(Network.ETHEREUM));

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
