import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/base-mainnet',
    chain:  getRpcUrl(Network.BASE),
  },
  network: Network.BASE,
  configFile: config.base,
  startBlock: 37095400,
  storeName: squidStoreNames[Network.BASE],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1, // 12s
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.BASE],
};

export default configurator;


