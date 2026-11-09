import type { SupportedNetwork } from './types';

export interface NetworkConfig {
  id: SupportedNetwork;
  chainId: number;
  name: string;
  defaultRpcUrl: string;
  envRpcKey: string;
  explorerUrl: string;
  blockscoutApiUrl: string;
}

export const SUPPORTED_NETWORKS: Record<SupportedNetwork, NetworkConfig> = {
  ethereum: {
    id: 'ethereum',
    chainId: 1,
    name: 'Ethereum Mainnet',
    defaultRpcUrl: 'https://ethereum-rpc.publicnode.com',
    envRpcKey: 'ETHEREUM_RPC_URL',
    explorerUrl: 'https://etherscan.io',
    blockscoutApiUrl: 'https://eth.blockscout.com/api',
  },
  base: {
    id: 'base',
    chainId: 8453,
    name: 'Base Mainnet',
    defaultRpcUrl: 'https://base.gateway.tenderly.co',
    envRpcKey: 'BASE_RPC_URL',
    explorerUrl: 'https://basescan.org',
    blockscoutApiUrl: 'https://base.blockscout.com/api',
  },
};

export function isSupportedNetwork(network: string): network is SupportedNetwork {
  return network === 'ethereum' || network === 'base';
}

export function getNetworkConfig(network: SupportedNetwork): NetworkConfig {
  const config = SUPPORTED_NETWORKS[network];
  if (!config) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return config;
}

export function getRpcUrl(network: SupportedNetwork): string {
  const config = getNetworkConfig(network);
  const envUrl = process.env[config.envRpcKey];
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  return config.defaultRpcUrl;
}
