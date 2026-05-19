/**
 * Expected Exchange Rate Configuration Helpers
 * 
 * Directly queries config.json for EER configuration.
 */

import { Log } from '../common/dataSet';
import { Config, ExpectedExchangeRateConfig } from '../common/types';
import { PortRequestFulfilled } from '../model';

/**
 * Get EER config for a vault address directly from config
 * Returns normalized config with all addresses in lowercase
 */
export function getEERConfigForVault(config: Config, vaultAddr: string): ExpectedExchangeRateConfig | undefined {
  if (!config.Port?.Vaults) return undefined;

  const vaultAddrLower = vaultAddr.toLowerCase();
  const vault = config.Port.Vaults.find(v => v.address.toLowerCase() === vaultAddrLower);
  
  if (!vault?.expectedExchangeRateConfig) return undefined;
  
  // borrowRateBps is required - if missing, treat as no config
  if (vault.expectedExchangeRateConfig.borrowRateBps === undefined) {
    return undefined;
  }
  
  // Return normalized config with all addresses in lowercase
  // NOTE: commitmentFeeTiers removed - commitment fee is now hard-coded
  return {
    borrower: vault.expectedExchangeRateConfig.borrower.toLowerCase(),
    assets: vault.expectedExchangeRateConfig.assets.map(a => a.toLowerCase()),
    borrowRateBps: vault.expectedExchangeRateConfig.borrowRateBps,
    eerDebug: vault.expectedExchangeRateConfig.eerDebug,
  };
}

/**
 * Check if EER debug logging is enabled for a vault.
 * Debug is enabled if the vault's expectedExchangeRateConfig has eerDebug: true.
 */
export function isEERDebugEnabled(config: Config, vaultAddr: string): boolean {
  const cfg = getEERConfigForVault(config, vaultAddr);
  return cfg?.eerDebug === true;
}

/**
 * Check if a given address is a configured vault (has expectedExchangeRateConfig)
 */
export function isConfiguredVault(config: Config, addr: string): boolean {
  return getEERConfigForVault(config, addr) !== undefined;
}

/**
 * Get union of all assets across all configured vaults
 */
export function getUnionAssets(config: Config): string[] {
  if (!config.Port?.Vaults) return [];

  const assetsSet = new Set<string>();
  for (const vault of config.Port.Vaults) {
    if (vault.expectedExchangeRateConfig) {
      for (const asset of vault.expectedExchangeRateConfig.assets) {
        assetsSet.add(asset.toLowerCase());
      }
    }
  }
  return Array.from(assetsSet);
}

/**
 * Extract vault address from Transfer log topics
 * Since we filter by topic1/topic2 in the data set, one of them must be the vault
 * Returns the vault address if found, undefined otherwise
 */
export function getVaultAddressFromTransferLog(
  config: Config,
  log: { topics: string[] },
  blockHeight?: number
): string | undefined {
  // Transfer event: topic0 = Transfer signature, topic1 = from, topic2 = to
  if (!log.topics || log.topics.length < 3) {
    return undefined;
  }

  // Extract addresses from topics (last 40 chars = 20 bytes = address)
  const fromTopic = log.topics[1];
  const toTopic = log.topics[2];
  const from = '0x' + fromTopic.slice(-40).toLowerCase();
  const to = '0x' + toTopic.slice(-40).toLowerCase();

  const isActiveConfiguredVault = (address: string) =>
    config.Port?.Vaults?.some((vault) =>
      vault.address.toLowerCase() === address &&
      vault.expectedExchangeRateConfig !== undefined &&
      (blockHeight === undefined || vault.block <= blockHeight)
    ) ?? false;

  if (isActiveConfiguredVault(from)) {
    return from;
  }
  if (isActiveConfiguredVault(to)) {
    return to;
  }

  return undefined;
}

/**
 * Get all configured vault addresses
 */
export function getConfiguredVaultAddresses(config: Config): string[] {
  if (!config.Port?.Vaults) return [];

  return config.Port.Vaults
    .filter(v => v.expectedExchangeRateConfig !== undefined)
    .map(v => v.address.toLowerCase());
}

/**
 * Check if EER simplified mode is enabled
 */
export function isEERSimplifiedMode(config: Config): boolean {
  return config.Port?.EER_MODE === 'hourly_simple_no_diversion';
}

/**
 * Check if a vault has funds diversion configured (Aave/Compound/Clearpool)
 */
export function hasVaultDiversion(config: Config, vaultAddress: string): boolean {
  if (!config.Port?.Strategies) return false;
  
  const vaultAddrLower = vaultAddress.toLowerCase();
  const strategies = config.Port.Strategies;
  
  // Check if vault has any diversion strategies
  // For now, we check if strategies exist at all - in the future we could check per-vault
  return !!(strategies.AAVE || strategies.COMPOUND || (strategies.CLEARPOOL && strategies.CLEARPOOL.length > 0));
}
