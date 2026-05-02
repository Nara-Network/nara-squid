import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    archive: 'https://v2.archive.subsquid.io/network/ethereum-mainnet',
    chain: getRpcUrl(Network.ETHEREUM),
  },
  network: Network.ETHEREUM,
  configFile: config.ethereum,
  startBlock: config.ethereum.startBlock,
  storeName: squidStoreNames[Network.ETHEREUM],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.ETHEREUM],
};

export default configurator;
