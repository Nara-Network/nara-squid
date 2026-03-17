import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/ethereum-mainnet',
    chain: getRpcUrl(Network.MAINNET),
  },
  network: Network.MAINNET,
  configFile: config.mainnet,
  startBlock: 24189125,
  storeName: squidStoreNames[Network.MAINNET],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1, // 12s
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.MAINNET],
};

export default configurator;
