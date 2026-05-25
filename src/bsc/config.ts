import { Configurator, poolSizeDelayByNetwork, squidStoreNames } from '../common/types';
import { Network } from '../model';

import config from '../config.json';

const configurator: Configurator = {
  network: Network.BSC,
  configFile: config.bsc,
  startBlock: config.bsc.startBlock,
  storeName: squidStoreNames[Network.BSC],
  portalUrl: 'https://portal.sqd.dev/datasets/binance-mainnet',
  syncedBlocksInterval: 1,
  batchSizeMulticall: 100,
  poolSizeDelayTs: poolSizeDelayByNetwork[Network.BSC],
};

export default configurator;
