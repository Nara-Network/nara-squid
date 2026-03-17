import { Store } from '@subsquid/typeorm-store';
import {
  BlockHeader,
  DataHandlerContext,
  EvmBatchProcessor,
  EvmBatchProcessorFields,
  Log as _Log,
  Transaction as _Transaction,
  GatewaySettings,
  RpcEndpointSettings,
} from '@subsquid/evm-processor';
import { Config } from './types';

import * as BoringVaultAbi from '../abi/BoringVault';
import * as AtomicQueueAbi from '../abi/AtomicQueue';
import * as TellerAbi from '../abi/TellerWithMultiAssetSupport';
import * as AccountantAbi from '../abi/AccountantWithRateProviders';
import * as AaveV3PoolAbi from '../abi/AaveV3Pool';
import * as CompoundUSDCAbi from '../abi/CompoundUSDC';
import * as ERC20Abi from '../abi/ERC20';
import { Network } from '../model';

const fields = {
  log: {
    topics: true,
    data: true,
    transactionHash: true,
  },
  block: {
    number: true,
    timestamp: true,
    hash: true,
  },
  transaction: {
    from: true,
    input: true,
    value: true,
    hash: true,
    sighash: true,
  },
};

function padAddress(address: string) {
  return '0x' + address.slice(2).toLowerCase().padStart(64, '0');
}

export function generateProcessor(
  src: { archive?: GatewaySettings | string; chain: RpcEndpointSettings | string, rateLimit?: number, maxBatchCallSize?: number },
  config: Config,
  finalityConfirmations: number | null
) {
  const { startBlock, Port } = config;

  const processor = new EvmBatchProcessor()
    .setDataSource(src)
    // .setGateway(src.archive)
    // .setRpcEndpoint(src.chain)
    .setRpcDataIngestionSettings({
      headPollInterval: 2000,
    })
    .setFields(fields)
    .includeAllBlocks({
      from: startBlock,
    })
    .setBlockRange({
      from: startBlock,
    });

  if (Port) {
    Port.Vaults.forEach((vault) => {
      const tellerEvents = [
        TellerAbi.events.Paused.topic,
        TellerAbi.events.Unpaused.topic,
        TellerAbi.events.AssetAdded.topic,
        TellerAbi.events.AssetRemoved.topic,
      ]
      const accountantEvents = [
        AccountantAbi.events.ExchangeRateUpdated.topic,
        AccountantAbi.events.ManagementFeeRateUpdated.topic,
        AccountantAbi.events.FeesClaimed.topic,
      ]
      tellerEvents.push(TellerAbi.events.DepositCapUpdated.topic)
      accountantEvents.push(AccountantAbi.events.LendingRateUpdated.topic)
      accountantEvents.push(AccountantAbi.events.ManagementFeeRateUpdated.topic)
      processor.addLog({
        address: [vault.address.toLowerCase()],
        topic0: [
          BoringVaultAbi.events.Enter.topic,
        ],
      });
      processor.addLog({
        address: [vault.Teller.toLowerCase()],
        topic0: tellerEvents,
      });
      processor.addLog({
        address: [vault.Accountant.toLowerCase()],
        topic0: accountantEvents,
      });
      processor.addLog({
        address: [vault.AtomicQueue.toLowerCase()],
        topic0: [
          AtomicQueueAbi.events.AtomicRequestUpdated.topic,
          AtomicQueueAbi.events.AtomicRequestFulfilled.topic,
        ],
      });
    });
  }

  if(Port?.Strategies?.AAVE) {
    processor.addLog({
      address: [Port.Strategies.AAVE.address.toLowerCase()],
      topic0: [AaveV3PoolAbi.events.Supply.topic, AaveV3PoolAbi.events.Withdraw.topic],
      topic1: [padAddress(Port.Strategies.AAVE.asset.toLowerCase())],
      topic2: Port.Vaults.map((vault) => padAddress(vault.address.toLowerCase())),
    });

    // processor.addLog({
    //   address: [Port.Strategies.AAVE.address.toLowerCase()],
    //   topic0: [AaveV3PoolAbi.events.Withdraw.topic],
    //   topic1: [padAddress(Port.Strategies.AAVE.asset.toLowerCase())],
    //   topic2: Port.Vaults.map((vault) => padAddress(vault.address.toLowerCase())),
    // });
  }

  if(Port?.Strategies?.COMPOUND) {
    processor.addLog({
      address: [Port.Strategies.COMPOUND.address.toLowerCase()],
      topic0: [
        CompoundUSDCAbi.events.Supply.topic,
        CompoundUSDCAbi.events.Withdraw.topic,
      ],
    });
  }

  // Add ERC20 Transfer events for scoped assets (borrower tracking)
  // Track transfers for ALL assets in vaults with expectedExchangeRateConfig
  // We track transfers from: Vault -> Borrower and Borrower -> Vault
  // topic1 = from, topic2 = to
  if (Port?.Vaults) {
    for (const vault of Port.Vaults) {
      if (!vault.expectedExchangeRateConfig) continue;

      const vaultAddrLower = vault.address.toLowerCase();
      const borrowerAddrLower = vault.expectedExchangeRateConfig.borrower.toLowerCase();
      
      // Pad addresses to 32 bytes (64 hex chars) for topic filtering
      const vaultTopic = padAddress(vaultAddrLower);
      const borrowerTopic = padAddress(borrowerAddrLower);

      // For each asset in the config, add filters for both directions
      for (const asset of vault.expectedExchangeRateConfig.assets) {
        const assetLower = asset.toLowerCase();

        processor.addLog({
          address: [assetLower],
          topic0: [ERC20Abi.events.Transfer.topic],
          topic1: [vaultTopic],
          topic2: [borrowerTopic],
        });

        processor.addLog({
          address: [assetLower],
          topic0: [ERC20Abi.events.Transfer.topic],
          topic1: [borrowerTopic],
          topic2: [vaultTopic],
        });
      }
    }
  }

  if (finalityConfirmations) {
    processor.setFinalityConfirmation(finalityConfirmations);
  }

  return processor;
}


export type Fields = EvmBatchProcessorFields<EvmBatchProcessor<typeof fields>>;
export type Block = BlockHeader<Fields>;
export type Log = _Log<Fields>;
export type Transaction = _Transaction<Fields>;
export type ProcessorContext = DataHandlerContext<Store, Fields> & {
  syncedNetwork: Network;
};
