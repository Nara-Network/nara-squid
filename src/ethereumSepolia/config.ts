import { Configurator, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  network: Network.ETHEREUM_SEPOLIA,
  configFile: config.ethereumSepolia,
  startBlock: config.ethereumSepolia.startBlock,
  storeName: squidStoreNames[Network.ETHEREUM_SEPOLIA],
  portalUrl: 'https://portal.sqd.dev/datasets/ethereum-sepolia',
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.ETHEREUM_SEPOLIA],
};

export default configurator;
