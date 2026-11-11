import { createPublicClient, fallback, getAddress, http, type PublicClient, type Address } from 'viem';
import { mainnet, base } from 'viem/chains';
import type { SupportedNetwork } from './types';
import { getNetworkConfig, getRpcUrls } from './networks';

export function createChainClient(network: SupportedNetwork): PublicClient<any, any> {
  const chain = network === 'ethereum' ? mainnet : base;
  const candidateUrls = getRpcUrls(network);

  const transports = candidateUrls.map((url) =>
    http(url, {
      timeout: 3_500,
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
