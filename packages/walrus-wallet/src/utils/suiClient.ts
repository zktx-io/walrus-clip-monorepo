import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from '@mysten/sui/jsonRpc';
import type { Transaction } from '@mysten/sui/transactions';
import type { NETWORK } from './walletTypes';

export type WalrusWalletSuiClient = SuiJsonRpcClient;

export const getWalrusWalletFullnodeUrl = (network: NETWORK) =>
  getJsonRpcFullnodeUrl(network);

export const createWalrusWalletDappKitNetworkConfig = (network: NETWORK) => ({
  url: getWalrusWalletFullnodeUrl(network),
});

export const createWalrusWalletSuiClient = (network: NETWORK) =>
  new SuiJsonRpcClient({
    network,
    url: getWalrusWalletFullnodeUrl(network),
  });

export const buildWalrusWalletTransaction = ({
  client,
  transaction,
  onlyTransactionKind,
}: {
  client: WalrusWalletSuiClient;
  transaction: Transaction;
  onlyTransactionKind?: boolean;
}) =>
  transaction.build({
    client,
    ...(onlyTransactionKind === undefined ? {} : { onlyTransactionKind }),
  });

export const executeWalrusWalletTransaction = (
  client: WalrusWalletSuiClient,
  input: Parameters<WalrusWalletSuiClient['executeTransactionBlock']>[0],
) => client.executeTransactionBlock(input);

export const waitForWalrusWalletTransaction = (
  client: WalrusWalletSuiClient,
  input: Parameters<WalrusWalletSuiClient['waitForTransaction']>[0],
) => client.waitForTransaction(input);

export const getWalrusWalletCurrentEpoch = async (network: NETWORK) => {
  const client = createWalrusWalletSuiClient(network);
  const { epoch } = await client.getLatestSuiSystemState();
  return epoch;
};
