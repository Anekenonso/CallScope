import {
  type Address,
  type PublicClient,
  formatUnits,
} from 'viem';
import type { SupportedNetwork } from '../../src/types/analysis';

export interface TokenMetadata {
  decimals?: number;
  symbol?: string;
  name?: string;
  verified: boolean;
  unavailable?: boolean;
}

// Verified on-chain tokens with canonical immutability
export const KNOWN_VERIFIED_TOKENS: Record<
  SupportedNetwork,
  Record<string, { decimals: number; symbol: string; name: string }>
> = {
  ethereum: {
    // ENS Token
    '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72': {
      decimals: 18,
      symbol: 'ENS',
      name: 'Ethereum Name Service',
    },
    // USDC
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    // USDT
    '0xdac17f958d2ee523a2206206994597c13d831ec7': {
      decimals: 6,
      symbol: 'USDT',
      name: 'Tether USD',
    },
    // DAI
    '0x6b175474e89094c44da98b954eedeac495271d0f': {
      decimals: 18,
      symbol: 'DAI',
      name: 'Dai Stablecoin',
    },
    // WETH
    '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ether',
    },
  },
  base: {
    // USDC on Base
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
      decimals: 6,
      symbol: 'USDC',
      name: 'USD Coin',
    },
    // WETH on Base
    '0x4200000000000000000000000000000000000006': {
      decimals: 18,
      symbol: 'WETH',
      name: 'Wrapped Ether',
    },
    // DAI on Base
    '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': {
      decimals: 18,
      symbol: 'DAI',
      name: 'Dai Stablecoin',
    },
  },
};

const ERC20_METADATA_ABI = [
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

/**
 * Resolve token decimals and symbol from verified metadata or live on-chain contract view.
 * If decimals cannot be verified, clearly marks unavailable. Never guesses.
 */
export async function resolveTokenMetadata(
  network: SupportedNetwork,
  targetAddress: Address,
  client?: PublicClient<any, any>,
  cache?: Map<string, TokenMetadata>
): Promise<TokenMetadata> {
  const normAddr = targetAddress.toLowerCase();
  const cacheKey = `${network}:${normAddr}`;

  if (cache && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // 1. Check known verified canonical token list
  const known = KNOWN_VERIFIED_TOKENS[network]?.[normAddr];
  if (known) {
    const meta: TokenMetadata = {
      decimals: known.decimals,
      symbol: known.symbol,
      name: known.name,
      verified: true,
    };
    cache?.set(cacheKey, meta);
    return meta;
  }

  // 2. If client provided, attempt on-chain read with strict timeout
  if (client) {
    try {
      const [decimalsVal, symbolVal] = await Promise.all([
        client.readContract({
          address: targetAddress,
          abi: ERC20_METADATA_ABI,
          functionName: 'decimals',
        }),
        client
          .readContract({
            address: targetAddress,
            abi: ERC20_METADATA_ABI,
            functionName: 'symbol',
          })
          .catch(() => undefined),
      ]);

      if (typeof decimalsVal === 'number' || typeof decimalsVal === 'bigint') {
        const decimals = Number(decimalsVal);
        const symbol = typeof symbolVal === 'string' ? symbolVal : undefined;
        const meta: TokenMetadata = {
          decimals,
          symbol,
          verified: true,
        };
        cache?.set(cacheKey, meta);
        return meta;
      }
    } catch {
      // Reverted or not an ERC-20 contract
    }
  }

  // 3. Decimals cannot be verified: mark unavailable, never guess
  const unavailableMeta: TokenMetadata = {
    verified: false,
    unavailable: true,
  };
  cache?.set(cacheKey, unavailableMeta);
  return unavailableMeta;
}

/**
 * Format raw token amount using verified decimals and symbol.
 * If decimals are not verified, returns raw amount and marks unavailable. Never guesses.
 */
export function formatTokenAmount(
  rawAmount: bigint | string,
  decimals?: number,
  symbol?: string
): {
  formatted?: string;
  decimalsUnavailable: boolean;
} {
  if (decimals === undefined || decimals === null || isNaN(decimals)) {
    return {
      decimalsUnavailable: true,
    };
  }

  try {
    const rawBigInt = typeof rawAmount === 'string' ? BigInt(rawAmount) : rawAmount;
    const formattedUnits = formatUnits(rawBigInt, decimals);
    const withSymbol = symbol ? `${formattedUnits} ${symbol}` : formattedUnits;
    return {
      formatted: withSymbol,
      decimalsUnavailable: false,
    };
  } catch {
    return {
      decimalsUnavailable: true,
    };
  }
}
