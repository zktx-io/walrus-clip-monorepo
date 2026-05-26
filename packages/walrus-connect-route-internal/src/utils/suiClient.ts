import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import type { Transaction } from '@mysten/sui/transactions';

import type { NETWORK } from '../types';

export type WalrusConnectSuiClient = SuiClient;
export type WalrusConnectGraphQLClient = SuiGraphQLClient;
export type WalrusConnectBuildableTransaction = {
  build: (input: {
    client: WalrusConnectSuiClient;
    onlyTransactionKind?: boolean;
  }) => Promise<Uint8Array>;
};

export const getWalrusConnectFullnodeUrl = (network: NETWORK) =>
  getFullnodeUrl(network);

export const getWalrusConnectGraphQLUrl = (network: NETWORK) =>
  `https://sui-${network}.mystenlabs.com/graphql`;

export const createWalrusConnectSuiClient = (network: NETWORK) =>
  new SuiClient({ url: getWalrusConnectFullnodeUrl(network) });

export const createWalrusConnectGraphQLClient = (network: NETWORK) =>
  new SuiGraphQLClient({
    network,
    url: getWalrusConnectGraphQLUrl(network),
  });

export const buildWalrusConnectTransaction = ({
  client,
  transaction,
  onlyTransactionKind,
}: {
  client: WalrusConnectSuiClient;
  transaction: WalrusConnectBuildableTransaction;
  onlyTransactionKind?: boolean;
}) =>
  transaction.build({
    client,
    ...(onlyTransactionKind === undefined ? {} : { onlyTransactionKind }),
  });

export const getWalrusConnectTransactionDigest = ({
  client,
  transaction,
}: {
  client: WalrusConnectSuiClient;
  transaction: Transaction;
}) => transaction.getDigest({ client });

export const dryRunWalrusConnectTransaction = (
  client: WalrusConnectSuiClient,
  input: Parameters<WalrusConnectSuiClient['dryRunTransactionBlock']>[0],
) => client.dryRunTransactionBlock(input);

export const executeWalrusConnectTransaction = (
  client: WalrusConnectSuiClient,
  input: Parameters<WalrusConnectSuiClient['executeTransactionBlock']>[0],
) => client.executeTransactionBlock(input);

export const waitForWalrusConnectTransaction = (
  client: WalrusConnectSuiClient,
  input: Parameters<WalrusConnectSuiClient['waitForTransaction']>[0],
) => client.waitForTransaction(input);
