import type { SuiSignAndExecuteTransactionOutput } from '@mysten/wallet-standard';
import { Transaction } from '@mysten/sui/transactions';
import { signHostOutcomeToResult } from '../internal/walrusConnectRoute';
import type { QRSignOutcome } from '../internal/walrusConnectRoute';

import { WalrusWalletQrRouteError } from './walletErrors';

export type WalletQrSignModal = (
  title: string,
  description: string,
  data: {
    transaction: {
      toJSON: () => Promise<string>;
    };
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
    },
  );

  return requireQrWalletResult(outcome);
};
