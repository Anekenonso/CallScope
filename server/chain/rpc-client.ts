import { createPublicClient, fallback, getAddress, http, type PublicClient, type Address } from 'viem';
import { mainnet, base } from 'viem/chains';
import type { SupportedNetwork } from './types';
import { getNetworkConfig, getRpcUrl } from './networks';

export function createChainClient(network: SupportedNetwork): PublicClient<any, any> {
  const rpcUrl = getRpcUrl(network);
  const chain = network === 'ethereum' ? mainnet : base;

  let candidateUrls: string[];
  if (network === 'base') {
    if (rpcUrl.includes('mainnet.base.org')) {
      candidateUrls = ['https://base-rpc.publicnode.com', rpcUrl, 'https://base.drpc.org'];
    } else {
      candidateUrls = [rpcUrl, 'https://base-rpc.publicnode.com', 'https://base.drpc.org'];
    }
  } else {
    candidateUrls = [
      rpcUrl,
      'https://gateway.tenderly.co/public/mainnet',
      'https://ethereum-rpc.publicnode.com',
    ];
  }

  const uniqueUrls = Array.from(new Set(candidateUrls.filter(Boolean)));
  const transports = uniqueUrls.map((url) =>
    http(url, {
      timeout: 8_000,
      retryCount: 0,
    })
  );

  return createPublicClient({
    chain,
    transport: fallback(transports, { rank: false }),
  });
}

export async function verifyNetworkChainId(
  network: SupportedNetwork,
  client: PublicClient<any, any>
): Promise<void> {
  const config = getNetworkConfig(network);
  const actualChainId = await client.getChainId();

  if (actualChainId !== config.chainId) {
    throw new Error(
      `Chain ID mismatch for ${network}: expected ${config.chainId}, RPC returned ${actualChainId}`
    );
  }
}

export async function validateGovernorContract(
  client: PublicClient<any, any>,
  governorAddress: string,
  network: SupportedNetwork
): Promise<Address> {
  let checksummedAddress: Address;
  try {
    checksummedAddress = getAddress(governorAddress.trim());
  } catch {
    throw new Error(`Invalid EVM address format: ${governorAddress}`);
  }

  const bytecode = await client.getCode({ address: checksummedAddress });

  if (!bytecode || bytecode === '0x' || bytecode === '0x0') {
    throw new Error(
      `Address ${checksummedAddress} does not contain contract bytecode on ${network}`
    );
  }

  return checksummedAddress;
}
