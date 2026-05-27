import type { NETWORK } from './walletTypes';

import { createWalrusWalletSuiClient } from './suiClient';

export type WalrusCoinMetadata = {
  id: string | null;
  decimals: number;
  name: string;
  symbol: string;
  description: string;
  iconUrl: string | null;
};

export type WalrusCoin = {
  objectId: string;
  version: string;
  digest: string;
  owner: unknown;
  type: string;
  balance: string;
};

export type WalrusCoreCoinBalance = {
  coinType: string;
  balance: string;
  coinBalance: string;
  addressBalance: string;
};

export type WalrusCoinBalance = {
  coinType: string;
  totalBalance: string;
  formattedBalance: string | null;
  coinBalance: string;
  addressBalance: string;
  metadata: WalrusCoinMetadata | null;
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
  balance: WalrusCoreCoinBalance,
  metadata: WalrusCoinMetadata | null,
): WalrusCoinBalance => {
  const decimals = metadata?.decimals;

  return {
    coinType: balance.coinType,
    totalBalance: balance.balance,
    formattedBalance:
      decimals === undefined
        ? null
        : formatWalrusCoinAmount(balance.balance, decimals),
    coinBalance: balance.coinBalance,
    addressBalance: balance.addressBalance,
    metadata,
  };
};

const withMetadata = async (
  client: ReturnType<typeof createWalrusWalletSuiClient>,
  balance: WalrusCoreCoinBalance,
): Promise<WalrusCoinBalance> => {
  const metadata = await client.core
    .getCoinMetadata({
      coinType: balance.coinType,
    })
    .then((result) => result.coinMetadata)
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
  const balances = await client.core
    .listBalances({ owner })
    .then((page) => page.balances);
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
}): Promise<WalrusCoin[]> => {
  const client = createWalrusWalletSuiClient(network);
  const coins: WalrusCoin[] = [];
  let cursor: string | null | undefined;
  let hasNextPage = true;

  while (hasNextPage) {
    const page = await client.core.listCoins({
      owner,
      coinType,
      cursor,
    });
    coins.push(...page.objects);
    cursor = page.cursor;
    hasNextPage = page.hasNextPage;
  }

  return coins;
};
