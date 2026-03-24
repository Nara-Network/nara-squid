import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/arbitrum-sepolia',
    chain: getRpcUrl(Network.ARBITRUM_SEPOLIA),
  },
  network: Network.ARBITRUM_SEPOLIA,
  configFile: config.arbitrumSepolia,
  startBlock: config.arbitrumSepolia.startBlock,
  storeName: squidStoreNames[Network.ARBITRUM_SEPOLIA],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.ARBITRUM_SEPOLIA],
};

export default configurator;
