import type { SignedTransaction } from '@mysten/wallet-standard';
import type { SuiSignAndExecuteTransactionOutput } from '@mysten/wallet-standard';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
  signHostOutcomeToResult,
} from '../internal/walrusConnectRoute';
import type { QRSignOutcome } from '../internal/walrusConnectRoute';

import {
  buildWalrusWalletTransaction,
  createWalrusWalletGrpcClient,
  executeWalrusWalletTransaction,
  waitForWalrusWalletTransaction,
} from '../utils/suiClient';
import type { NETWORK } from '../utils/walletTypes';
import type { ZkLoginSigner } from '../utils/zkLoginSigner';
import {
  WalrusWalletQrRouteError,
  WalrusWalletTransactionExecutionError,
  WalrusWalletTransactionUncertainError,
} from './walletErrors';

const WALRUS_WALLET_SUI_TRANSPORT = 'grpc' as const;

export type WalletQrSignModal = (
  title: string,
  description: string,
  data: {
    transaction: {
      toJSON: () => Promise<string>;
    };
    sponsoredUrl?: string;
  },
) => Promise<QRSignOutcome>;

const requireQrWalletResult = (outcome: QRSignOutcome) => {
  const result = signHostOutcomeToResult(outcome);
  if (result) return result;

  switch (outcome.type) {
    case 'failed_before_submit':
      throw new WalrusWalletQrRouteError({
        reason: outcome.reason,
      });
    case 'execute_result_unknown':
      throw new WalrusWalletQrRouteError({
        reason: outcome.reason,
        bytes: outcome.bytes,
        signature: outcome.signature,
        digest: outcome.digest,
        submitted: outcome.digest !== undefined,
        finalityUnknown: true,
      });
    case 'submitted_delivery_failed':
    case 'submitted_finality_unknown':
      throw new WalrusWalletQrRouteError({
        reason: outcome.reason,
        bytes: outcome.bytes,
        signature: outcome.signature,
        digest: outcome.digest,
        submitted: true,
        finalityUnknown: true,
      });
    case 'finalized_delivery_failed':
      throw new WalrusWalletQrRouteError({
        reason: outcome.reason,
        bytes: outcome.bytes,
        signature: outcome.signature,
        digest: outcome.digest,
        effects: outcome.effects,
        submitted: true,
        finalityUnknown: false,
      });
    case 'signed_and_finalized':
      throw new WalrusWalletQrRouteError({
        reason: 'QR route returned a finalized result as an error.',
        bytes: outcome.bytes,
        signature: outcome.signature,
        digest: outcome.digest,
        effects: outcome.effects,
        submitted: true,
        finalityUnknown: false,
      });
  }
};

const waitForExecutedTransaction = async ({
  client,
  digest,
  bytes,
  signature,
}: {
  client: ReturnType<typeof createWalrusWalletGrpcClient>;
  digest: string;
  bytes: string;
  signature: string;
}): Promise<SuiSignAndExecuteTransactionOutput> => {
  try {
    const { rawEffects } = await waitForWalrusWalletTransaction(client, {
      digest,
      timeout: 30000,
    });
    return {
      digest,
      bytes,
      signature,
      effects: toBase64(rawEffects),
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new WalrusWalletTransactionUncertainError({
        phase: 'confirmation',
        digest,
        bytes,
        signature,
        reason: error.message,
        suiTransport: WALRUS_WALLET_SUI_TRANSPORT,
      });
    }
    throw error;
  }
};

export const signTransactionWithLocalSigner = async ({
  signer,
  network,
  transaction,
}: {
  signer: ZkLoginSigner;
  network: NETWORK;
  transaction: { toJSON: () => Promise<string> };
}): Promise<SignedTransaction> => {
  const client = createWalrusWalletGrpcClient(network);
  const tx = Transaction.from(await transaction.toJSON());
  tx.setSenderIfNotSet(signer.toSuiAddress());
  const txBytes = await buildWalrusWalletTransaction({
    client,
    transaction: tx,
  });

  return signer.signTransaction(txBytes);
};

export const signAndExecuteTransactionWithLocalSigner = async ({
  signer,
  network,
  transaction,
  sponsoredUrl,
}: {
  signer: ZkLoginSigner;
  network: NETWORK;
  transaction: { toJSON: () => Promise<string> };
  sponsoredUrl?: string;
}): Promise<SuiSignAndExecuteTransactionOutput> => {
  const client = createWalrusWalletGrpcClient(network);
  const tx = Transaction.from(await transaction.toJSON());
  tx.setSenderIfNotSet(signer.toSuiAddress());

  if (sponsoredUrl) {
    const transactionKindBytes = await buildWalrusWalletTransaction({
      client,
      transaction: tx,
      onlyTransactionKind: true,
    });
    const { bytes: sponsoredBytes, digest } = await createSponsoredTransaction(
      sponsoredUrl,
      network,
      signer.toSuiAddress(),
      transactionKindBytes,
    );
    const { signature } = await signer.signTransaction(fromBase64(sponsoredBytes));

    try {
      await executeSponsoredTransaction(sponsoredUrl, digest, signature);
    } catch (error) {
      if (error instanceof Error) {
        throw new WalrusWalletTransactionUncertainError({
          phase: 'sponsored-execution',
          digest,
          bytes: sponsoredBytes,
          signature,
          reason: error.message,
        });
      }
      throw error;
    }

    return waitForExecutedTransaction({
      client,
      digest,
      bytes: sponsoredBytes,
      signature,
    });
  }

  const txBytes = await buildWalrusWalletTransaction({
    client,
    transaction: tx,
  });
  const { bytes, signature } = await signer.signTransaction(txBytes);

  let result: Awaited<ReturnType<typeof executeWalrusWalletTransaction>>;
  try {
    result = await executeWalrusWalletTransaction(client, {
      bytes: txBytes,
      signature,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new WalrusWalletTransactionExecutionError({
        reason: `Failed to execute transaction: ${error.message}`,
        suiTransport: WALRUS_WALLET_SUI_TRANSPORT,
      });
    }
    throw error;
  }

  if (result.errors.length > 0) {
    // Core API returned a FailedTransaction. The transaction reached
    // execution and has a known digest; preserve it (and the signed
    // bytes/signature) on the caller-visible error so dApps can recover.
    throw new WalrusWalletTransactionExecutionError({
      reason: `Transaction ${result.digest} executed but reported failure: ${result.errors.join(', ')}`,
      digest: result.digest,
      bytes,
      signature,
      suiTransport: WALRUS_WALLET_SUI_TRANSPORT,
    });
  }

  return waitForExecutedTransaction({
    client,
    digest: result.digest,
    bytes,
    signature,
  });
};

export const signAndExecuteTransactionWithQrRoute = async ({
  openSignTxModal,
  transaction,
  sponsoredUrl,
}: {
  openSignTxModal: WalletQrSignModal;
  transaction: { toJSON: () => Promise<string> };
  sponsoredUrl?: string;
}): Promise<SuiSignAndExecuteTransactionOutput> => {
  const tx = Transaction.from(await transaction.toJSON());
  const outcome = await openSignTxModal(
    'Sign and Execute',
    'Please scan the QR code to sign.',
    {
      transaction: tx,
      sponsoredUrl,
    },
  );

  return requireQrWalletResult(outcome);
};
