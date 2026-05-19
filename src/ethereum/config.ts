import { Configurator, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  network: Network.ETHEREUM,
  configFile: config.ethereum,
  startBlock: config.ethereum.startBlock,
  storeName: squidStoreNames[Network.ETHEREUM],
  portalUrl: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.ETHEREUM],
};

export default configurator;
