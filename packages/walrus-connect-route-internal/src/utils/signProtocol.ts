import { Transaction } from '@mysten/sui/transactions';

import type {
  ProtocolEnvelope,
  ProtocolErrorCode,
  ProtocolErrorPayload,
} from './message';
import type { WalrusConnectSuiClient } from './suiClient';

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
  | 'sponsor_create'
  | 'transaction_proposal'
  | 'validate_sender'
  | 'validate_digest'
  | 'dry_run'
  | 'review'
  | 'sign'
  | 'sign_response'
  | 'signature_verify'
  | 'sponsor_execute'
  | 'execute'
  | 'submitted'
  | 'finality';

export type PendingSignTransaction = {
  bytes: string;
  rawBytes?: Uint8Array;
  expectedDigest?: string;
  signerAddress: string;
};

export type WalrusConnectTransactionDigestReader = ({
  client,
  transaction,
}: {
  client: WalrusConnectSuiClient;
  transaction: Transaction;
}) => Promise<string> | string;

export type SignProtocolValidationError = {
  code: Extract<
    ProtocolErrorCode,
    | 'invalid_payload'
    | 'message_expired'
    | 'transaction_validation_failed'
    | 'transaction_failed'
    | 'sponsor_failed'
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

export const getExpectedSubmittedDigest = async ({
  tx,
  client,
  expectedDigest,
  getTransactionDigest,
}: {
  tx: Transaction;
  client: WalrusConnectSuiClient;
  expectedDigest?: string;
  getTransactionDigest: WalrusConnectTransactionDigestReader;
}) =>
  expectedDigest ??
  getTransactionDigest({ client, transaction: tx });

export const validateSubmittedDigest = async ({
  tx,
  client,
  expectedDigest,
  submittedDigest,
  getTransactionDigest,
}: {
  tx: Transaction;
  client: WalrusConnectSuiClient;
  expectedDigest?: string;
  submittedDigest: string;
  getTransactionDigest: WalrusConnectTransactionDigestReader;
}): Promise<
  | { ok: true; digest: string }
  | { ok: false; error: SignProtocolValidationError }
> => {
  const resolvedExpectedDigest = await getExpectedSubmittedDigest({
    tx,
    client,
    expectedDigest,
    getTransactionDigest,
  });

  if (submittedDigest !== resolvedExpectedDigest) {
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

  return { ok: true, digest: resolvedExpectedDigest };
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
