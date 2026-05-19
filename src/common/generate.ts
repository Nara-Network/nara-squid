import { TypeormDatabase } from '@subsquid/typeorm-store';

import { DataSetContextNoSyncedNetwork } from '../common/dataSet';
import { parseContext } from '../common/parser/logs';
import { Configurator } from './types';

const logsDataSetParser = (configurator: Configurator) => {
  const db = new TypeormDatabase({
    stateSchema: configurator.storeName,
    isolationLevel: 'READ COMMITTED',
    supportHotBlocks: true,
  });

  const parser = (ctx: DataSetContextNoSyncedNetwork) =>
    parseContext(
      { ...ctx, syncedNetwork: configurator.network },
      configurator.configFile,
      configurator.syncedBlocksInterval,
      configurator.batchSizeMulticall,
      configurator.poolSizeDelayTs
    );

  return { db, parser };
};

export {
  logsDataSetParser,
};
