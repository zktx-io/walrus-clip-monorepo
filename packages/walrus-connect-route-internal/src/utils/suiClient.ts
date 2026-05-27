import { SuiGrpcClient } from '@mysten/sui/grpc';
import type { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';

import type { NETWORK } from '../types';

export type WalrusConnectGrpcClient = SuiGrpcClient;
export type WalrusConnectReviewClient = SuiGrpcClient;
export type WalrusConnectBuildableTransaction = {
  build: (input: {
    client: WalrusConnectGrpcClient;
    onlyTransactionKind?: boolean;
  }) => Promise<Uint8Array>;
};

// SDK README documents these as the gRPC-Web baseUrls.
// `.WORK/ts-sdks/packages/sui/README.md:75-81`.
const WALRUS_CONNECT_GRPC_BASE_URLS: Record<NETWORK, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

export const getWalrusConnectGrpcBaseUrl = (network: NETWORK) =>
  WALRUS_CONNECT_GRPC_BASE_URLS[network];

export const createWalrusConnectGrpcClient = (network: NETWORK) =>
  new SuiGrpcClient({
    network,
    baseUrl: getWalrusConnectGrpcBaseUrl(network),
  });

export const createWalrusConnectReviewClient = createWalrusConnectGrpcClient;

export const buildWalrusConnectTransaction = ({
  client,
  transaction,
  onlyTransactionKind,
}: {
  client: WalrusConnectGrpcClient;
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
  client: WalrusConnectGrpcClient;
  transaction: Transaction;
}) => transaction.getDigest({ client });

export const simulateWalrusConnectTransaction = (
  client: WalrusConnectReviewClient,
  input: { transactionBlock: string },
) =>
  client.core.simulateTransaction({
    transaction: fromBase64(input.transactionBlock),
    include: {
      balanceChanges: true,
      effects: true,
      events: true,
      objectTypes: true,
    },
  });

export type WalrusConnectExecuteInput = {
  bytes: Uint8Array;
  signature: string;
};

export type WalrusConnectExecuteResult = {
  digest: string;
  errors: string[];
};

export const executeWalrusConnectTransaction = async (
  client: WalrusConnectGrpcClient,
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
  client: WalrusConnectGrpcClient,
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
