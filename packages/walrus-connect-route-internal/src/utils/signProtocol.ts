import { Transaction } from '@mysten/sui/transactions';

import type {
  ProtocolEnvelope,
  ProtocolErrorCode,
  ProtocolErrorPayload,
} from './message';
import type { WalrusConnectGrpcClient } from './suiClient';

export const TRANSACTION_PROPOSAL_TIMEOUT_MS = 15000;
export const SIGN_RESPONSE_TIMEOUT_MS = 30000;
export const SUBMISSION_TIMEOUT_MS = 30000;
export const FINALITY_TIMEOUT_MS = 70000;
export const ACK_TIMEOUT_MS = 5000;
export const CLOSE_FALLBACK_TIMEOUT_MS = 5000;

export type SignProtocolPhase =
  | 'connect'
  | 'address'
  | 'build'
  | 'transaction_proposal'
  | 'validate_sender'
  | 'validate_digest'
  | 'dry_run'
  | 'review'
  | 'sign'
  | 'personal_message'
  | 'personal_message_response'
  | 'sign_response'
  | 'signature_verify'
  | 'execute'
  | 'submitted'
  | 'finality';

export type PendingSignTransaction = {
  bytes: string;
  rawBytes?: Uint8Array;
  signerAddress: string;
};

export type PendingPersonalMessage = {
  bytes: string;
  rawBytes: Uint8Array;
  signerAddress: string;
};

export type WalrusConnectTransactionDigestReader = ({
  client,
  transaction,
}: {
  client: WalrusConnectGrpcClient;
  transaction: Transaction;
}) => Promise<string> | string;

export type SignProtocolValidationError = {
  code: Extract<
    ProtocolErrorCode,
    | 'invalid_payload'
    | 'message_expired'
    | 'transaction_validation_failed'
    | 'transaction_failed'
  >;
  message: string;
  phase?: SignProtocolPhase;
  digest?: string;
};

export const createSignProtocolErrorPayload = ({
  code,
  message,
  phase,
  digest,
}: {
  code: ProtocolErrorCode;
  message: string;
  phase: SignProtocolPhase;
  digest?: string;
}): ProtocolErrorPayload =>
  ({
    code,
    message,
    details: {
      phase,
      ...(digest ? { digest } : {}),
    },
  });

export const requirePendingSignTransaction = (
  pendingTransaction: PendingSignTransaction | undefined,
):
  | { ok: true; pendingTransaction: PendingSignTransaction }
  | { ok: false; error: SignProtocolValidationError } => {
  if (!pendingTransaction) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message: 'Sign response has no pending transaction',
        phase: 'signature_verify',
      },
    };
  }

  return { ok: true, pendingTransaction };
};

export const validateProtocolMessageFresh = (
  message: ProtocolEnvelope,
  now = Date.now(),
): { ok: true } | { ok: false; error: SignProtocolValidationError } => {
  if (message.expiresAt <= now) {
    return {
      ok: false,
      error: {
        code: 'message_expired',
        message: 'Protocol message expired before signing',
        phase: 'sign',
      },
    };
  }

  return { ok: true };
};

export const validateSubmittedDigest = async ({
  tx,
  client,
  submittedDigest,
  getTransactionDigest,
}: {
  tx: Transaction;
  client: WalrusConnectGrpcClient;
  submittedDigest: string;
  getTransactionDigest: WalrusConnectTransactionDigestReader;
}): Promise<
  | { ok: true; digest: string }
  | { ok: false; error: SignProtocolValidationError }
> => {
  const computedDigest = await getTransactionDigest({
    client,
    transaction: tx,
  });

  if (submittedDigest !== computedDigest) {
    return {
      ok: false,
      error: {
        code: 'transaction_failed',
        message: 'Submitted transaction digest does not match transaction',
        phase: 'submitted',
        digest: submittedDigest,
      },
    };
  }

  return { ok: true, digest: computedDigest };
};

export const validateFinalizedDigest = ({
  submittedDigest,
  finalizedDigest,
}: {
  submittedDigest: string;
  finalizedDigest: string;
}): { ok: true } | { ok: false; error: SignProtocolValidationError } => {
  if (submittedDigest !== finalizedDigest) {
    return {
      ok: false,
      error: {
        code: 'transaction_failed',
        message: 'Finalized transaction digest does not match submission',
        phase: 'finality',
        digest: finalizedDigest,
      },
    };
  }

  return { ok: true };
};
