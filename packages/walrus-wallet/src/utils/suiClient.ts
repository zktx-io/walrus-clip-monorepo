import { SuiGrpcClient } from '@mysten/sui/grpc';
import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from '@mysten/sui/jsonRpc';
import type { Transaction } from '@mysten/sui/transactions';
import type { NETWORK } from './walletTypes';

export type WalrusWalletSuiClient = SuiJsonRpcClient;

export type WalrusWalletGrpcClient = SuiGrpcClient;

export const getWalrusWalletFullnodeUrl = (network: NETWORK) =>
  getJsonRpcFullnodeUrl(network);

// SDK README documents these as the gRPC-Web baseUrls.
// `.WORK/ts-sdks/packages/sui/README.md:75-81`.
const WALRUS_WALLET_GRPC_BASE_URLS: Record<NETWORK, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

export const getWalrusWalletGrpcBaseUrl = (network: NETWORK) =>
  WALRUS_WALLET_GRPC_BASE_URLS[network];

export const createWalrusWalletSuiClient = (network: NETWORK) =>
  new SuiJsonRpcClient({
    network,
    url: getWalrusWalletFullnodeUrl(network),
  });

export const createWalrusWalletGrpcClient = (network: NETWORK) =>
  new SuiGrpcClient({
    network,
    baseUrl: getWalrusWalletGrpcBaseUrl(network),
  });

export const buildWalrusWalletTransaction = ({
  client,
  transaction,
  onlyTransactionKind,
}: {
  client: WalrusWalletGrpcClient;
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
  client: WalrusWalletGrpcClient,
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
  client: WalrusWalletGrpcClient,
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
  client: WalrusWalletGrpcClient,
): Promise<string> => {
  const { systemState } = await client.core.getCurrentSystemState();
  return systemState.epoch;
};

export const getWalrusWalletCurrentEpoch = (network: NETWORK) =>
  readEpochFromWalrusWalletClient(createWalrusWalletGrpcClient(network));
