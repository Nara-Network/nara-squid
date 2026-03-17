import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/ethereum-sepolia',
    chain: getRpcUrl(Network.SEPOLIA),
  },
  network: Network.SEPOLIA,
  configFile: config.sepolia,
  startBlock: 6057560,
  storeName: squidStoreNames[Network.SEPOLIA],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1, // 12s
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.SEPOLIA],
};

export default configurator;
