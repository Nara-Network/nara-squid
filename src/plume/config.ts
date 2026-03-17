import { Configurator, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/plume',
    chain: 'https://rpc.plume.org',
  },
  network: Network.PLUME,
  configFile: config.plume,
  startBlock: 23145997,
  storeName: squidStoreNames[Network.PLUME],
  finalityConfirmations: 100,
  batchSizeMulticall: 100,
  syncedBlocksInterval: 1, // 1s ??
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.PLUME],
};

export default configurator;


