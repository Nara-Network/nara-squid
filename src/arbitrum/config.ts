import { Configurator, getRpcUrl, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  rpc: {
    chain: getRpcUrl(Network.ARBITRUM),
  },
  network: Network.ARBITRUM,
  configFile: config.arbitrum,
  startBlock: config.arbitrum.startBlock,
  storeName: squidStoreNames[Network.ARBITRUM],
  finalityConfirmations: 75,
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.ARBITRUM],
};

export default configurator;
