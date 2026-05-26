import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from '@mysten/sui/jsonRpc';
import type { Transaction } from '@mysten/sui/transactions';
import type { NETWORK } from './walletTypes';

export type WalrusWalletSuiClient = SuiJsonRpcClient;

export const getWalrusWalletFullnodeUrl = (network: NETWORK) =>
  getJsonRpcFullnodeUrl(network);

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

export type WalrusWalletExecuteInput = {
  bytes: Uint8Array;
  signature: string;
};

export type WalrusWalletExecuteResult = {
  digest: string;
  errors: string[];
};

export const executeWalrusWalletTransaction = async (
  client: WalrusWalletSuiClient,
  input: WalrusWalletExecuteInput,
): Promise<WalrusWalletExecuteResult> => {
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

export type WalrusWalletWaitInput = {
  digest: string;
  timeout?: number;
};

export type WalrusWalletWaitResult = {
  rawEffects: Uint8Array;
};

export const waitForWalrusWalletTransaction = async (
  client: WalrusWalletSuiClient,
  input: WalrusWalletWaitInput,
): Promise<WalrusWalletWaitResult> => {
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

export const readEpochFromWalrusWalletClient = async (
  client: WalrusWalletSuiClient,
): Promise<string> => {
  const { systemState } = await client.core.getCurrentSystemState();
  return systemState.epoch;
};

export const getWalrusWalletCurrentEpoch = (network: NETWORK) =>
  readEpochFromWalrusWalletClient(createWalrusWalletSuiClient(network));
