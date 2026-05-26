import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from '@mysten/sui/jsonRpc';
import type { Transaction } from '@mysten/sui/transactions';

import type { NETWORK } from '../types';

export type WalrusConnectSuiClient = SuiJsonRpcClient;
export type WalrusConnectBuildableTransaction = {
  build: (input: {
    client: WalrusConnectSuiClient;
    onlyTransactionKind?: boolean;
  }) => Promise<Uint8Array>;
};

export const getWalrusConnectFullnodeUrl = (network: NETWORK) =>
  getJsonRpcFullnodeUrl(network);

export const createWalrusConnectSuiClient = (network: NETWORK) =>
  new SuiJsonRpcClient({
    network,
    url: getWalrusConnectFullnodeUrl(network),
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

export type WalrusConnectExecuteInput = {
  bytes: Uint8Array;
  signature: string;
};

export type WalrusConnectExecuteResult = {
  digest: string;
  errors: string[];
};

export const executeWalrusConnectTransaction = async (
  client: WalrusConnectSuiClient,
  input: WalrusConnectExecuteInput,
): Promise<WalrusConnectExecuteResult> => {
  const result = await client.core.executeTransaction({
    transaction: input.bytes,
    signatures: [input.signature],
  });
  if (result.$kind === 'Transaction') {
    return { digest: result.Transaction.digest, errors: [] };
  }
  const failed = result.FailedTransaction;
  const message =
    failed.status.success === false
      ? failed.status.error.message
      : 'Transaction execution reported failure without an error message';
  return { digest: failed.digest, errors: [message] };
};

export type WalrusConnectWaitInput = {
  digest: string;
  timeout?: number;
};

export type WalrusConnectWaitResult = {
  rawEffects: Uint8Array;
};

export const waitForWalrusConnectTransaction = async (
  client: WalrusConnectSuiClient,
  input: WalrusConnectWaitInput,
): Promise<WalrusConnectWaitResult> => {
  const result = await client.core.waitForTransaction({
    digest: input.digest,
    include: { effects: true },
    timeout: input.timeout,
  });
  const transaction =
    result.$kind === 'Transaction'
      ? result.Transaction
      : result.FailedTransaction;
  const bcs = transaction.effects?.bcs;
  if (!bcs) {
    throw new Error(
      `Transaction ${input.digest} finalized but effects.bcs is missing.`,
    );
  }
  return { rawEffects: bcs };
};
