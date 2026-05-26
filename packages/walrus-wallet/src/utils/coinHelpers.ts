import type {
  CoinBalance,
  CoinMetadata,
  CoinStruct,
} from '@mysten/sui/jsonRpc';
import type { NETWORK } from './walletTypes';

import { createWalrusWalletSuiClient } from './suiClient';

export type WalrusCoinBalance = {
  coinType: string;
  totalBalance: string;
  formattedBalance: string | null;
  lockedBalance: Record<
    string,
    { balance: string; formattedBalance: string | null }
  >;
  metadata: CoinMetadata | null;
};

export const formatWalrusCoinAmount = (
  rawAmount: string,
  decimals: number,
): string => {
  const amount = BigInt(rawAmount);
  const scale = Math.max(0, decimals);
  const padded = amount.toString().padStart(scale + 1, '0');
  const integerPart = scale === 0 ? padded : padded.slice(0, -scale) || '0';
  const fractionalPart =
    scale === 0 ? '' : padded.slice(-scale).replace(/0+$/, '');

  return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
};

export const formatWalrusCoinBalance = (
  balance: CoinBalance,
  metadata: CoinMetadata | null,
): WalrusCoinBalance => {
  const decimals = metadata?.decimals;
  const lockedBalance: WalrusCoinBalance['lockedBalance'] = {};

  for (const [key, value] of Object.entries(balance.lockedBalance)) {
    lockedBalance[key] = {
      balance: value,
      formattedBalance:
        decimals === undefined ? null : formatWalrusCoinAmount(value, decimals),
    };
  }

  return {
    coinType: balance.coinType,
    totalBalance: balance.totalBalance,
    formattedBalance:
      decimals === undefined
        ? null
        : formatWalrusCoinAmount(balance.totalBalance, decimals),
    lockedBalance,
    metadata,
  };
};

const withMetadata = async (
  client: ReturnType<typeof createWalrusWalletSuiClient>,
  balance: CoinBalance,
): Promise<WalrusCoinBalance> => {
  const metadata = await client
    .getCoinMetadata({
      coinType: balance.coinType,
    })
    .catch(() => null);

  return formatWalrusCoinBalance(balance, metadata);
};

export const getWalrusCoinBalances = async ({
  network,
  owner,
}: {
  network: NETWORK;
  owner: string;
}): Promise<WalrusCoinBalance[]> => {
  const client = createWalrusWalletSuiClient(network);
  const balances = await client.getAllBalances({ owner });
  const hydrated = await Promise.all(
    balances.map((balance) => withMetadata(client, balance)),
  );

  return hydrated.sort((a, b) =>
    a.coinType === '0x2::sui::SUI'
      ? -1
      : b.coinType === '0x2::sui::SUI'
        ? 1
        : a.coinType.localeCompare(b.coinType),
  );
};

export const getWalrusCoins = async ({
  network,
  owner,
  coinType,
}: {
  network: NETWORK;
  owner: string;
  coinType: string;
}): Promise<CoinStruct[]> => {
  const client = createWalrusWalletSuiClient(network);
  const coins: CoinStruct[] = [];
  let cursor: string | null | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await client.getCoins({
      owner,
      coinType,
      cursor,
    });
    coins.push(...page.data);
    cursor = page.nextCursor;
    hasNextPage = page.hasNextPage;
  }

  return coins;
};
