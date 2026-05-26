import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { verifyTransactionSignature } from '@mysten/sui/verify';

import type { NETWORK } from '../types';
import {
  createProtocolErrorPayload,
  createProtocolMessage,
  parseProtocolMessage,
  ProtocolMessageError,
  type ProtocolErrorCode,
  type ProtocolErrorPayload,
} from '../utils/message';
import {
  createSignProtocolErrorPayload,
  type PendingSignTransaction,
  type SignProtocolPhase,
} from '../utils/signProtocol';
import {
  createWalrusConnectGraphQLClient,
  getWalrusConnectTransactionDigest,
  type WalrusConnectSuiClient,
} from '../utils/suiClient';

export const protocolCodec = {
  createMessage: createProtocolMessage,
  parseMessage: parseProtocolMessage,
};

export const throwProtocolValidationError = (
  error: {
    code: ProtocolErrorCode;
    message: string;
    phase?: SignProtocolPhase;
    digest?: string;
  },
  fallbackPhase?: SignProtocolPhase,
): never => {
  throw new ProtocolMessageError(
    createProtocolErrorPayload(
      error.code,
      error.message,
      error.phase || error.digest || fallbackPhase
        ? {
            phase: error.phase ?? fallbackPhase,
            ...(error.digest ? { digest: error.digest } : {}),
          }
        : undefined,
    ),
  );
};

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const errorCodeForPhase = (phase: SignProtocolPhase): ProtocolErrorCode => {
  if (phase === 'sponsor_create' || phase === 'sponsor_execute') {
    return 'sponsor_failed';
  }
  if (
    phase === 'execute' ||
    phase === 'submitted' ||
    phase === 'finality' ||
    phase === 'sign' ||
    phase === 'sign_response'
  ) {
    return 'transaction_failed';
  }
  if (
    phase === 'build' ||
    phase === 'signature_verify' ||
    phase === 'validate_sender' ||
    phase === 'validate_digest' ||
    phase === 'dry_run'
  ) {
    return 'transaction_validation_failed';
  }
  return 'internal_error';
};

export const protocolErrorFromUnknown = ({
  error,
  phase,
  fallbackMessage,
  digest,
}: {
  error: unknown;
  phase: SignProtocolPhase;
  fallbackMessage: string;
  digest?: string;
}): ProtocolErrorPayload =>
  error instanceof ProtocolMessageError
    ? error.payload
    : createSignProtocolErrorPayload({
        code: errorCodeForPhase(phase),
        message: `${fallbackMessage}: ${getErrorMessage(error)}`,
        phase,
        digest,
      });

export const verifyPendingTransactionSignature = async ({
  pendingTransaction,
  signature,
  network,
}: {
  pendingTransaction: PendingSignTransaction;
  signature: string;
  network: NETWORK;
}) => {
  const client = createWalrusConnectGraphQLClient(network);

  await verifyTransactionSignature(
    fromBase64(pendingTransaction.bytes),
    signature,
    {
      address: pendingTransaction.signerAddress,
      client,
    },
  );
};

export const validateExpectedDigest = async (
  tx: Transaction,
  client: WalrusConnectSuiClient,
  expectedDigest?: string,
) => {
  if (!expectedDigest) return;

  const computedDigest = await getWalrusConnectTransactionDigest({
    client,
    transaction: tx,
  });
  if (computedDigest !== expectedDigest) {
    throw new ProtocolMessageError(
      createSignProtocolErrorPayload({
        code: 'transaction_validation_failed',
        message: 'Host-provided transaction digest does not match transaction bytes',
        phase: 'validate_digest',
        digest: expectedDigest,
      }),
    );
  }
};
