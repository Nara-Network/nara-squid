import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/ethereum-sepolia',
    chain: getRpcUrl(Network.ETHEREUM_SEPOLIA),
  },
  network: Network.ETHEREUM_SEPOLIA,
  configFile: config.ethereumSepolia,
  startBlock: config.ethereumSepolia.startBlock,
  storeName: squidStoreNames[Network.ETHEREUM_SEPOLIA],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.ETHEREUM_SEPOLIA],
};

export default configurator;
