import type { DataHandlerContext as BaseDataHandlerContext } from '@subsquid/batch-processor';
import * as evmObjects from '@subsquid/evm-objects';
import { DataSourceBuilder, FieldSelection } from '@subsquid/evm-stream';
import type { Logger } from '@subsquid/logger';
import { RpcClient } from '@subsquid/rpc-client';
import { Store } from '@subsquid/typeorm-store';

import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import * as AaveV3PoolAbi from '../abi/AaveV3Pool';
import * as AtomicQueueAbi from '../abi/AtomicQueue';
import * as BoringVaultAbi from '../abi/BoringVault';
import * as CompoundUSDCAbi from '../abi/CompoundUSDC';
import * as ERC20Abi from '../abi/ERC20';
import * as NaraUSD from '../abi/NaraUSD';
import * as TellerAbi from '../abi/TellerWithMultiAssetSupport';
import { Network } from '../model';
import { Configurator } from './types';
import { getTrackedTokenAddress } from './mapping/baseTokens';

const fields = {
  log: {
    topics: true,
    data: true,
    transactionHash: true,
    address: true,
  },
  block: {
    timestamp: true,
  },
  transaction: {
    from: true,
    input: true,
    value: true,
    hash: true,
    sighash: true,
  },
} satisfies FieldSelection;

const DEFAULT_PORTAL_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_PORTAL_MAX_IDLE_TIME_MS = 2_000;
const DEFAULT_PORTAL_MAX_WAIT_TIME_MS = 10_000;

function getPositiveIntegerEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (value == null) return fallback;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function padAddress(address: string) {
  return '0x' + address.slice(2).toLowerCase().padStart(64, '0');
}

function shouldIncludeAllBlocks(): boolean {
  return process.env.INCLUDE_ALL_BLOCKS === 'true';
}

export function generatePortalDataSet(configurator: Configurator) {
  const { startBlock, Port } = configurator.configFile;

  const dataSet = new DataSourceBuilder()
    .setPortal({
      url: configurator.portalUrl,
      maxBytes: getPositiveIntegerEnv('SQD_PORTAL_MAX_BYTES', DEFAULT_PORTAL_MAX_BYTES),
      maxIdleTime: getPositiveIntegerEnv('SQD_PORTAL_MAX_IDLE_TIME_MS', DEFAULT_PORTAL_MAX_IDLE_TIME_MS),
      maxWaitTime: getPositiveIntegerEnv('SQD_PORTAL_MAX_WAIT_TIME_MS', DEFAULT_PORTAL_MAX_WAIT_TIME_MS),
    })
    .setFields(fields)
    .setBlockRange({ from: startBlock });

  if (shouldIncludeAllBlocks()) {
    dataSet.includeAllBlocks({ from: startBlock });
  }

  if (Port) {
    Port.Vaults.forEach((vault) => {
      const tellerEvents = [
        TellerAbi.events.Paused.topic,
        TellerAbi.events.Unpaused.topic,
        TellerAbi.events.AssetAdded.topic,
        TellerAbi.events.AssetRemoved.topic,
        TellerAbi.events.DepositCapUpdated.topic,
      ];
      const accountantEvents = [
        AccountantAbi.events.ExchangeRateUpdated.topic,
        AccountantAbi.events.ManagementFeeRateUpdated.topic,
        AccountantAbi.events.FeesClaimed.topic,
        AccountantAbi.events.LendingRateUpdated.topic,
        AccountantAbi.events.ManagementFeeRateUpdated.topic,
      ];

      dataSet.addLog({
        where: {
          address: [vault.address.toLowerCase()],
          topic0: [BoringVaultAbi.events.Enter.topic],
        },
      });
      dataSet.addLog({
        where: {
          address: [vault.Teller.toLowerCase()],
          topic0: tellerEvents,
        },
      });
      dataSet.addLog({
        where: {
          address: [vault.Accountant.toLowerCase()],
          topic0: accountantEvents,
        },
      });
      dataSet.addLog({
        where: {
          address: [vault.AtomicQueue.toLowerCase()],
          topic0: [
            AtomicQueueAbi.events.AtomicRequestUpdated.topic,
            AtomicQueueAbi.events.AtomicRequestFulfilled.topic,
          ],
        },
      });
    });
  }

  if (Port?.Strategies?.AAVE) {
    dataSet.addLog({
      where: {
        address: [Port.Strategies.AAVE.address.toLowerCase()],
        topic0: [
          AaveV3PoolAbi.events.Supply.topic,
          AaveV3PoolAbi.events.Withdraw.topic,
        ],
        topic1: [padAddress(Port.Strategies.AAVE.asset.toLowerCase())],
        topic2: Port.Vaults.map((vault) =>
          padAddress(vault.address.toLowerCase()),
        ),
      },
    });
  }

  if (Port?.Strategies?.COMPOUND) {
    dataSet.addLog({
      where: {
        address: [Port.Strategies.COMPOUND.address.toLowerCase()],
        topic0: [
          CompoundUSDCAbi.events.Supply.topic,
          CompoundUSDCAbi.events.Withdraw.topic,
        ],
      },
    });
  }

  if (Port?.Vaults) {
    for (const vault of Port.Vaults) {
      if (!vault.expectedExchangeRateConfig) continue;

      const vaultTopic = padAddress(vault.address.toLowerCase());
      const borrowerTopic = padAddress(
        vault.expectedExchangeRateConfig.borrower.toLowerCase(),
      );

      for (const asset of vault.expectedExchangeRateConfig.assets) {
        const assetLower = asset.toLowerCase();

        dataSet.addLog({
          where: {
            address: [assetLower],
            topic0: [ERC20Abi.events.Transfer.topic],
            topic1: [vaultTopic],
            topic2: [borrowerTopic],
          },
        });

        dataSet.addLog({
          where: {
            address: [assetLower],
            topic0: [ERC20Abi.events.Transfer.topic],
            topic1: [borrowerTopic],
            topic2: [vaultTopic],
          },
        });
      }
    }
  }

  const naraUsdAddress = configurator.network === Network.BSC
    ? undefined
    : getTrackedTokenAddress(configurator.network, 'NaraUSD');
  if (naraUsdAddress) {
    dataSet.addLog({
      where: {
        address: [naraUsdAddress],
        topic0: [
          NaraUSD.events.Redeem.topic,
          NaraUSD.events.RedemptionRequested.topic,
          NaraUSD.events.RedemptionCompleted.topic,
        ],
      },
    });
  }

  return dataSet.build();
}

export type Fields = typeof fields;
export type Block = evmObjects.BlockHeader<Fields>;
export type BlockData = evmObjects.Block<Fields>;
export type Log = evmObjects.Log<Fields>;
export type Transaction = evmObjects.Transaction<Fields>;
export type DataSetContext = BaseDataHandlerContext<BlockData, Store> & {
  log: Logger;
  syncedNetwork: Network;
  _chain: {
    client: RpcClient;
  };
};
export type DataSetContextNoSyncedNetwork = Omit<
  DataSetContext,
  'syncedNetwork'
>;
export type ProcessorContext = DataSetContext;
