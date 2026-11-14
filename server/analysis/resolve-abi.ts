import {
  type Address,
  type Abi,
  type Hex,
  type PublicClient,
  getAddress,
  zeroAddress,
  parseAbi,
} from 'viem';
import type { SupportedNetwork } from '../../src/types/analysis';
import { SUPPORTED_NETWORKS } from '../chain/networks';

export const EIP1967_IMPLEMENTATION_SLOT =
  '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc' as Hex;
export const EIP1967_BEACON_SLOT =
  '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50' as Hex;
export const EIP1822_SLOT =
  '0xc5f1683af45b279097e0619675973273e3b44c7a683a383cac60c1b05029ca95' as Hex;
export const OZ_CLASSIC_SLOT =
  '0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3' as Hex;

export interface ResolvedAbiResult {
  abi?: Abi;
  contractName?: string;
  isProxy?: boolean;
  implementationAddress?: Address;
  isContract: boolean;
  source?: 'blockscout' | 'sourcify' | 'fallback';
  error?: string;
}

const BEACON_ABI = parseAbi([
  'function implementation() view returns (address)',
]);

/**
 * Detect verifiable on-chain proxy implementation through standard storage slots
 */
export async function detectProxyImplementation(
  client: PublicClient<any, any>,
  address: Address
): Promise<{ isProxy: boolean; implementationAddress?: Address }> {
  const slotsToCheck = [
    EIP1967_IMPLEMENTATION_SLOT,
    EIP1822_SLOT,
    OZ_CLASSIC_SLOT,
  ];

  for (const slot of slotsToCheck) {
    try {
      const storage = await client.getStorageAt({ address, slot });
      if (storage && storage !== '0x' && !/^0x0+$/.test(storage)) {
        const candidate = getAddress(`0x${storage.slice(-40)}`);
        if (candidate !== zeroAddress) {
          const code = await client.getCode({ address: candidate });
          if (code && code !== '0x') {
            return { isProxy: true, implementationAddress: candidate };
          }
        }
      }
    } catch {
      // Continue checking other slots on error
    }
  }

  // Check EIP-1967 Beacon slot
  try {
    const beaconStorage = await client.getStorageAt({
      address,
      slot: EIP1967_BEACON_SLOT,
    });
    if (beaconStorage && beaconStorage !== '0x' && !/^0x0+$/.test(beaconStorage)) {
      const beaconAddress = getAddress(`0x${beaconStorage.slice(-40)}`);
      if (beaconAddress !== zeroAddress) {
        const impl = await client.readContract({
          address: beaconAddress,
          abi: BEACON_ABI,
          functionName: 'implementation',
        });
        if (impl && impl !== zeroAddress) {
          const code = await client.getCode({ address: impl });
          if (code && code !== '0x') {
            return { isProxy: true, implementationAddress: impl };
          }
        }
      }
    }
  } catch {
    // Continue
  }

  return { isProxy: false };
}

/**
 * Fetch verified smart contract metadata and ABI from Blockscout REST API v2
 */
async function fetchFromBlockscoutV2(
  network: SupportedNetwork,
  address: Address
): Promise<{ abi?: Abi; contractName?: string; isProxy?: boolean; implementationAddress?: Address } | null> {
  const domain = network === 'ethereum' ? 'eth.blockscout.com' : 'base.blockscout.com';
  const url = `https://${domain}/api/v2/smart-contracts/${address}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (!data || typeof data !== 'object') {
      return null;
    }

    const abi = Array.isArray(data.abi) ? (data.abi as Abi) : undefined;
    const contractName = typeof data.name === 'string' ? data.name : undefined;

    let isProxy = Boolean(data.is_proxy || (Array.isArray(data.implementations) && data.implementations.length > 0));
    let implementationAddress: Address | undefined;

    if (Array.isArray(data.implementations) && data.implementations.length > 0) {
      const firstImpl = data.implementations[0]?.address;
      if (typeof firstImpl === 'string') {
        try {
          implementationAddress = getAddress(firstImpl);
          isProxy = true;
        } catch {
          // invalid address
        }
      }
    }

    if (abi || isProxy || implementationAddress || contractName) {
      return { abi, contractName, isProxy, implementationAddress };
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch verified contract ABI from Blockscout v1 API
 */
async function fetchFromBlockscoutV1(
  network: SupportedNetwork,
  address: Address
): Promise<{ abi?: Abi; contractName?: string } | null> {
  const domain = network === 'ethereum' ? 'eth.blockscout.com' : 'base.blockscout.com';
  const url = `https://${domain}/api?module=contract&action=getabi&address=${address}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (data.status === '1' && typeof data.result === 'string') {
      const parsed = JSON.parse(data.result);
      if (Array.isArray(parsed)) {
        return { abi: parsed as Abi };
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch verified contract metadata and ABI from Sourcify open repository
 */
async function fetchFromSourcify(
  network: SupportedNetwork,
  address: Address
): Promise<{ abi?: Abi; contractName?: string } | null> {
  const chainId = SUPPORTED_NETWORKS[network].chainId;
  const url = `https://sourcify.dev/server/files/any/${chainId}/${address}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Callscope/1.0 (DAO Proposal Analyzer)',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    if (Array.isArray(data.files)) {
      const metadataFile = data.files.find((f: any) => f.name === 'metadata.json');
      if (metadataFile && typeof metadataFile.content === 'string') {
        const metaObj = JSON.parse(metadataFile.content);
        const abi = metaObj.output?.abi;
        const targets = Object.keys(metaObj.settings?.compilationTarget || {});
        let contractName: string | undefined;
        if (targets.length > 0 && targets[0]) {
          const rawName = metaObj.settings.compilationTarget[targets[0]];
          contractName = typeof rawName === 'string' ? rawName : targets[0].split('/').pop()?.replace('.sol', '');
        }

        if (Array.isArray(abi)) {
          return { abi: abi as Abi, contractName };
        }
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve verified ABI for a contract address, handling proxies and fallback verified sources
 */
export async function resolveContractAbi(
  network: SupportedNetwork,
  rawAddress: string,
  client: PublicClient<any, any>,
  cache?: Map<string, ResolvedAbiResult>
): Promise<ResolvedAbiResult> {
  let address: Address;
  try {
    address = getAddress(rawAddress);
  } catch {
    return {
      isContract: false,
      error: `Invalid address: ${rawAddress}`,
    };
  }

  const cacheKey = `${network}:${address.toLowerCase()}`;
  if (cache?.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // Verify contract code exists
  const code = await client.getCode({ address });
  if (!code || code === '0x') {
    const res: ResolvedAbiResult = {
      isContract: false,
      error: `Target ${address} has no contract code (EOA or self-destructed)`,
    };
    cache?.set(cacheKey, res);
    return res;
  }

  // 1. Detect on-chain proxy status
  const onChainProxy = await detectProxyImplementation(client, address);
  let isProxy = onChainProxy.isProxy;
  let implementationAddress = onChainProxy.implementationAddress;

  // 2. Fetch target metadata and ABI
  // On Base, Sourcify is primary due to Cloudflare challenge on base.blockscout.com
  let targetMetadata: { abi?: Abi; contractName?: string; isProxy?: boolean; implementationAddress?: Address } | null = null;

  if (network === 'base') {
    const sourcifyMeta = await fetchFromSourcify(network, address);
    if (sourcifyMeta?.abi) {
      targetMetadata = sourcifyMeta;
    } else {
      targetMetadata = await fetchFromBlockscoutV2(network, address);
    }
  } else {
    targetMetadata = await fetchFromBlockscoutV2(network, address);
    if (!targetMetadata?.abi) {
      const sourcifyMeta = await fetchFromSourcify(network, address);
      if (sourcifyMeta?.abi) {
        targetMetadata = {
          ...targetMetadata,
          abi: sourcifyMeta.abi,
          contractName: sourcifyMeta.contractName || targetMetadata?.contractName,
        };
      }
    }
  }

  // If still no ABI, try Blockscout v1
  if (!targetMetadata?.abi) {
    const v1Meta = await fetchFromBlockscoutV1(network, address);
    if (v1Meta?.abi) {
      targetMetadata = {
        ...targetMetadata,
        abi: v1Meta.abi,
      };
    }
  }

  // Check if Blockscout identified a proxy
  if (targetMetadata?.isProxy) {
    isProxy = true;
    if (targetMetadata.implementationAddress && !implementationAddress) {
      implementationAddress = targetMetadata.implementationAddress;
    }
  }

  // 3. If target is a proxy and implementation address is identified, resolve implementation ABI!
  if (isProxy && implementationAddress) {
    let implMetadata: { abi?: Abi; contractName?: string } | null = null;

    if (network === 'base') {
      const sourcifyImpl = await fetchFromSourcify(network, implementationAddress);
      if (sourcifyImpl?.abi) {
        implMetadata = sourcifyImpl;
      } else {
        implMetadata = await fetchFromBlockscoutV2(network, implementationAddress);
      }
    } else {
      implMetadata = await fetchFromBlockscoutV2(network, implementationAddress);
      if (!implMetadata?.abi) {
        const sourcifyImpl = await fetchFromSourcify(network, implementationAddress);
        if (sourcifyImpl?.abi) {
          implMetadata = {
            ...implMetadata,
            abi: sourcifyImpl.abi,
            contractName: sourcifyImpl.contractName || implMetadata?.contractName,
          };
        }
      }
    }

    if (!implMetadata?.abi) {
      const v1Impl = await fetchFromBlockscoutV1(network, implementationAddress);
      if (v1Impl?.abi) {
        implMetadata = {
          ...implMetadata,
          abi: v1Impl.abi,
        };
      }
    }

    if (implMetadata?.abi) {
      // Merge proxy ABI and implementation ABI (implementation functions take precedence)
      const combinedAbi: Abi = [
        ...(targetMetadata?.abi || []),
        ...implMetadata.abi,
      ];

      const res: ResolvedAbiResult = {
        abi: combinedAbi,
        contractName: implMetadata.contractName || targetMetadata?.contractName,
        isProxy: true,
        implementationAddress,
        isContract: true,
        source: 'blockscout',
      };
      cache?.set(cacheKey, res);
      return res;
    }
  }

  // 4. Return target ABI if resolved
  if (targetMetadata?.abi) {
    const res: ResolvedAbiResult = {
      abi: targetMetadata.abi,
      contractName: targetMetadata.contractName,
      isProxy,
      implementationAddress,
      isContract: true,
      source: 'blockscout',
    };
    cache?.set(cacheKey, res);
    return res;
  }

  // Unverified or ABI unavailable
  const res: ResolvedAbiResult = {
    contractName: targetMetadata?.contractName,
    isProxy,
    implementationAddress,
    isContract: true,
    error: `Verified ABI unavailable for target ${address}`,
  };
  cache?.set(cacheKey, res);
  return res;
}
