import { TypeormDatabase } from '@subsquid/typeorm-store';

import { ProcessorContext, generateProcessor, /* generateQueryProcessor */ } from '../common/processor';
import { parseContext } from '../common/parser/logs';
import { Configurator } from './types';

const logsProcessorGenerator = (configurator: Configurator) => {
  return generateProcessor(
    configurator.rpc,
    configurator.configFile,
    configurator.network,
    configurator.finalityConfirmations
  );
};


const logsProcessorParser = (configurator: Configurator) => {
  const db = new TypeormDatabase({
    stateSchema: configurator.storeName,
    isolationLevel: 'READ COMMITTED',
    supportHotBlocks: true,
  });

  const parser = (ctx: Omit<ProcessorContext, 'syncedNetwork'>) =>
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
  logsProcessorGenerator,
  logsProcessorParser,
};
