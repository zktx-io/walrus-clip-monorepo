import type {
  SignedTransaction,
  SuiSignAndExecuteTransactionOutput,
  SuiSignPersonalMessageOutput,
} from '@mysten/wallet-standard';
import { Transaction } from '@mysten/sui/transactions';
import { signHostOutcomeToResult } from '../internal/walrusConnectRoute';
import type { QRSignOutcome } from '../internal/walrusConnectRoute';

import { WalrusWalletQrRouteError } from './walletErrors';

export type WalletQrSignModal = (
  title: string,
  description: string,
  data:
    | {
        type: 'transaction';
        intent: 'sign' | 'signAndExecute';
        transaction: {
          toJSON: () => Promise<string>;
        };
      }
    | {
        type: 'personalMessage';
        message: Uint8Array;
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
    case 'signed':
    case 'personal_message_signed':
      throw new WalrusWalletQrRouteError({
        reason: 'QR route returned a sign-only result for an execute request.',
        bytes: outcome.bytes,
        signature: outcome.signature,
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

const requireQrSignedTransaction = (outcome: QRSignOutcome): SignedTransaction => {
  if (outcome.type === 'signed') {
    return {
      bytes: outcome.bytes,
      signature: outcome.signature,
    };
  }

  if (outcome.type === 'failed_before_submit') {
    throw new WalrusWalletQrRouteError({ reason: outcome.reason });
  }

  throw new WalrusWalletQrRouteError({
    reason: 'QR route returned a non-transaction-sign result.',
    bytes: 'bytes' in outcome ? outcome.bytes : undefined,
    signature: 'signature' in outcome ? outcome.signature : undefined,
    digest: 'digest' in outcome ? outcome.digest : undefined,
    effects: 'effects' in outcome ? outcome.effects : undefined,
    submitted: 'digest' in outcome && outcome.digest !== undefined,
    finalityUnknown:
      outcome.type === 'execute_result_unknown' ||
      outcome.type === 'submitted_delivery_failed' ||
      outcome.type === 'submitted_finality_unknown',
  });
};

const requireQrPersonalMessage = (
  outcome: QRSignOutcome,
): SuiSignPersonalMessageOutput => {
  if (outcome.type === 'personal_message_signed') {
    return {
      bytes: outcome.bytes,
      signature: outcome.signature,
    };
  }

  if (outcome.type === 'failed_before_submit') {
    throw new WalrusWalletQrRouteError({ reason: outcome.reason });
  }

  throw new WalrusWalletQrRouteError({
    reason: 'QR route returned a non-personal-message result.',
    bytes: 'bytes' in outcome ? outcome.bytes : undefined,
    signature: 'signature' in outcome ? outcome.signature : undefined,
    digest: 'digest' in outcome ? outcome.digest : undefined,
    effects: 'effects' in outcome ? outcome.effects : undefined,
    submitted: 'digest' in outcome && outcome.digest !== undefined,
    finalityUnknown:
      outcome.type === 'execute_result_unknown' ||
      outcome.type === 'submitted_delivery_failed' ||
      outcome.type === 'submitted_finality_unknown',
  });
};

export const signAndExecuteTransactionWithQrRoute = async ({
  openSignTxModal,
  transaction,
}: {
  openSignTxModal: WalletQrSignModal;
  transaction: { toJSON: () => Promise<string> };
}): Promise<SuiSignAndExecuteTransactionOutput> => {
  const tx = Transaction.from(await transaction.toJSON());
  const outcome = await openSignTxModal(
    'Sign and Execute',
    'Please scan the QR code to sign.',
    {
      transaction: tx,
      intent: 'signAndExecute',
      type: 'transaction',
    },
  );

  return requireQrWalletResult(outcome);
};

export const signTransactionWithQrRoute = async ({
  openSignTxModal,
  transaction,
}: {
  openSignTxModal: WalletQrSignModal;
  transaction: { toJSON: () => Promise<string> };
}): Promise<SignedTransaction> => {
  const tx = Transaction.from(await transaction.toJSON());
  const outcome = await openSignTxModal(
    'Sign Transaction',
    'Please scan the QR code to sign.',
    {
      transaction: tx,
      intent: 'sign',
      type: 'transaction',
    },
  );

  return requireQrSignedTransaction(outcome);
};

export const signPersonalMessageWithQrRoute = async ({
  openSignTxModal,
  message,
}: {
  openSignTxModal: WalletQrSignModal;
  message: Uint8Array;
}): Promise<SuiSignPersonalMessageOutput> => {
  const outcome = await openSignTxModal(
    'Sign Message',
    'Please scan the QR code to sign.',
    {
      message,
      type: 'personalMessage',
    },
  );

  return requireQrPersonalMessage(outcome);
};
