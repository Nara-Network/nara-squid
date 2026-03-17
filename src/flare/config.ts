import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/flare-mainnet',
    chain: getRpcUrl(Network.FLARE),
  },
  network: Network.FLARE,
  configFile: config.flare,
  startBlock: 49483895,
  storeName: squidStoreNames[Network.FLARE],
  finalityConfirmations: 75,
  syncedBlocksInterval: 3, // 12s
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.FLARE],
};

export default configurator;


