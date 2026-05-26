import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';

import { EffectAuthority, EffectAuthorityTerminatedError } from './effectAuthority';
import {
  initialSignScannerLifecycleState,
  type SignChainFact,
  type SignDeliveryFact,
  type SignScannerLifecycleState,
} from './signLifecycle';
import {
  getErrorMessage,
  protocolCodec,
  protocolErrorFromUnknown,
  throwProtocolValidationError,
  validateExpectedDigest,
} from './signRuntime';
import { ProtocolSession, type ProtocolTransport } from './session';
import type { ClipSigner, NETWORK, NotiVariant } from '../types';
import {
  createProtocolErrorPayload,
  formatProtocolError,
  isProtocolErrorMessage,
  ProtocolMessageError,
  type ProtocolEnvelope,
  type ProtocolErrorPayload,
  type ProtocolMessageType,
  type ProtocolPayloadByType,
} from '../utils/message';
import {
  approveSignTransactionReview,
  createSignTransactionReview,
  getTransactionSenderValidationError,
} from '../utils/signTransactionReview';
import {
  ACK_TIMEOUT_MS,
  CLOSE_FALLBACK_TIMEOUT_MS,
  FINALITY_TIMEOUT_MS,
  SUBMISSION_TIMEOUT_MS,
  TRANSACTION_PROPOSAL_TIMEOUT_MS,
  createSignProtocolErrorPayload,
  type SignProtocolPhase,
  validateFinalizedDigest,
  validateProtocolMessageFresh,
  validateSubmittedDigest,
} from '../utils/signProtocol';
import {
  createWalrusConnectReviewClient,
  createWalrusConnectGrpcClient,
  getWalrusConnectTransactionDigest,
  waitForWalrusConnectTransaction,
  type WalrusConnectReviewClient,
  type WalrusConnectGrpcClient,
} from '../utils/suiClient';

type SignedScannerTransaction = {
  tx: Transaction;
  bytes: string;
  expectedDigest?: string;
  submittedDigest?: string;
};

export type SignScannerRunnerDeps = {
  createClient: (network: NETWORK) => WalrusConnectGrpcClient;
  createReviewClient: (network: NETWORK) => WalrusConnectReviewClient;
  decodeBytes: (bytes: string) => Uint8Array;
  encodeBytes: (bytes: Uint8Array) => string;
  createTransactionFromBytes: (bytes: Uint8Array) => Transaction;
  validateExpectedDigest: typeof validateExpectedDigest;
  validateSubmittedDigest: typeof validateSubmittedDigest;
  validateFinalizedDigest: typeof validateFinalizedDigest;
  getTransactionDigest: typeof getWalrusConnectTransactionDigest;
  createSignTransactionReview: typeof createSignTransactionReview;
  approveSignTransactionReview: typeof approveSignTransactionReview;
  getTransactionSenderValidationError: typeof getTransactionSenderValidationError;
};

export type SignScannerRunnerTimeouts = {
  proposalMs: number;
  submissionMs: number;
  finalityMs: number;
  ackMs: number;
  closeFallbackMs: number;
};

const defaultDeps: SignScannerRunnerDeps = {
  createClient: createWalrusConnectGrpcClient,
  createReviewClient: createWalrusConnectReviewClient,
  decodeBytes: fromBase64,
  encodeBytes: toBase64,
  createTransactionFromBytes: (bytes) => Transaction.from(bytes),
  validateExpectedDigest,
  validateSubmittedDigest,
  validateFinalizedDigest,
  getTransactionDigest: getWalrusConnectTransactionDigest,
  createSignTransactionReview,
  approveSignTransactionReview,
  getTransactionSenderValidationError,
};

const defaultTimeouts: SignScannerRunnerTimeouts = {
  proposalMs: TRANSACTION_PROPOSAL_TIMEOUT_MS,
  submissionMs: SUBMISSION_TIMEOUT_MS,
  finalityMs: FINALITY_TIMEOUT_MS,
  ackMs: ACK_TIMEOUT_MS,
  closeFallbackMs: CLOSE_FALLBACK_TIMEOUT_MS,
};

const terminalChain = (
  signedTransaction: SignedScannerTransaction | undefined,
): SignChainFact =>
  signedTransaction?.submittedDigest
    ? {
        type: 'digest_known',
        bytes: signedTransaction.bytes,
        signature: '',
        digest: signedTransaction.submittedDigest,
      }
    : { type: 'no_submit' };

const closedDelivery = (reason: string): SignDeliveryFact => ({
  type: 'closed',
  reason,
});

export const startSignScannerRunner = ({
  signer,
  network,
  sessionId,
  transport,
  onEvent,
  deps: partialDeps,
  timeouts: partialTimeouts,
}: {
  signer: ClipSigner;
  network: NETWORK;
  sessionId: string;
  transport: ProtocolTransport;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  deps?: Partial<SignScannerRunnerDeps>;
  timeouts?: Partial<SignScannerRunnerTimeouts>;
}): {
  session: ProtocolSession;
  cancel: (reason?: string) => void;
  dispose: () => void;
  getState: () => SignScannerLifecycleState;
} => {
  const deps = { ...defaultDeps, ...partialDeps };
  const timeouts = { ...defaultTimeouts, ...partialTimeouts };
  const client = deps.createClient(network);
  const reviewClient = deps.createReviewClient(network);
  const authority = new EffectAuthority();
  let state: SignScannerLifecycleState = initialSignScannerLifecycleState();
  let signedTransaction: SignedScannerTransaction | undefined;
  let localProtocolErrorRequested = false;
  let suppressCloseWarning = false;
  let clearProposalTimer: (() => void) | undefined;
  let clearSubmissionTimer: (() => void) | undefined;
  let clearFinalityTimer: (() => void) | undefined;
  let closeFallbackTimeout: ReturnType<typeof setTimeout> | undefined;
  let session: ProtocolSession;

  const isTerminal = () => state.type === 'terminal';

  const clearCloseFallbackTimeout = () => {
    if (closeFallbackTimeout) clearTimeout(closeFallbackTimeout);
    closeFallbackTimeout = undefined;
  };

  const clearAllTimeouts = () => {
    clearProposalTimer?.();
    clearSubmissionTimer?.();
    clearFinalityTimer?.();
    clearProposalTimer = undefined;
    clearSubmissionTimer = undefined;
    clearFinalityTimer = undefined;
  };

  const markTerminal = (
    reason: string,
    remoteTerminal?: ProtocolEnvelope<'protocol.error'>,
  ) => {
    if (isTerminal()) return;
    clearAllTimeouts();
    clearCloseFallbackTimeout();
    authority.terminate('completed');
    state = {
      type: 'terminal',
      chain: terminalChain(signedTransaction),
      delivery: closedDelivery(reason),
      ...(remoteTerminal ? { remoteTerminal } : {}),
    };
  };

  const sendProtocol = <TType extends ProtocolMessageType>(
    type: TType,
    payload: ProtocolPayloadByType[TType],
  ) => authority.send(session, type, payload);

  const closeAfterFallback = () => {
    clearCloseFallbackTimeout();
    closeFallbackTimeout = setTimeout(() => {
      markTerminal('success');
      session?.close('success');
    }, timeouts.closeFallbackMs);
  };

  const closeWithLocalError = (payload: ProtocolErrorPayload) => {
    if (isTerminal() || localProtocolErrorRequested) return;
    localProtocolErrorRequested = true;
    suppressCloseWarning = true;
    clearAllTimeouts();
    clearCloseFallbackTimeout();
    onEvent({
      variant: 'error',
      message: formatProtocolError(payload),
    });

    if (session?.isActive()) {
      void (async () => {
        try {
          await session.sendAndWaitForAck({
            type: 'protocol.error',
            payload,
            expectedAckType: 'protocol.error.ack',
            timeoutMs: timeouts.ackMs,
            closeOnAck: true,
            validateAck: (message) => message.payload.code === payload.code,
          });
        } catch {}
        session?.close('protocol_error');
        markTerminal(formatProtocolError(payload));
      })();
      return;
    }

    try {
      transport.close('protocol_error');
    } catch {}
    markTerminal(formatProtocolError(payload));
  };

  const startProposalTimeout = () => {
    clearProposalTimer?.();
    clearProposalTimer = authority.setTimeout(() => {
      if (state.type !== 'awaiting_transaction') return;
      closeWithLocalError(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: 'Timed out waiting for transaction proposal',
          phase: 'transaction_proposal',
        }),
      );
    }, timeouts.proposalMs);
  };

  const startSubmissionTimeout = () => {
    clearSubmissionTimer?.();
    clearSubmissionTimer = authority.setTimeout(() => {
      if (state.type !== 'awaiting_submitted') return;
      closeWithLocalError(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: 'Timed out waiting for transaction submission',
          phase: 'submitted',
        }),
      );
    }, timeouts.submissionMs);
  };

  const startFinalityTimeout = (digest: string) => {
    clearFinalityTimer?.();
    clearFinalityTimer = authority.setTimeout(() => {
      if (state.type !== 'awaiting_finalized') return;
      closeWithLocalError(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: 'Timed out waiting for transaction finality',
          phase: 'finality',
          digest,
        }),
      );
    }, timeouts.finalityMs);
  };

  const handleRemoteTerminal = (message: ProtocolEnvelope<'protocol.error'>) => {
    suppressCloseWarning = true;
    authority.trySendTerminalAck(session, message, {
      code: message.payload.code,
      ackSequence: message.sequence,
    });
    markTerminal(formatProtocolError(message.payload), message);
    closeAfterFallback();
    onEvent({
      variant: 'error',
      message: formatProtocolError(message.payload),
    });
  };

  const handleSubmitted = async (message: ProtocolEnvelope<'sign.submitted'>) => {
    clearSubmissionTimer?.();
    const pendingTransaction = signedTransaction;
    if (state.type !== 'awaiting_submitted' || !pendingTransaction) {
      throw new ProtocolMessageError(
        createSignProtocolErrorPayload({
          code: 'invalid_payload',
          message: 'Sign submission has no pending transaction',
          phase: 'submitted',
          digest: message.payload.digest,
        }),
      );
    }

    const submittedValidation = await authority.cancellable(() =>
      deps.validateSubmittedDigest({
        tx: pendingTransaction.tx,
        client,
        expectedDigest: pendingTransaction.expectedDigest,
        submittedDigest: message.payload.digest,
        getTransactionDigest: deps.getTransactionDigest,
      }),
    );
    if (isTerminal() || !session?.isActive()) return;

    let submittedDigest: string;
    if ('digest' in submittedValidation) {
      submittedDigest = submittedValidation.digest;
    } else {
      throw new ProtocolMessageError(
        createProtocolErrorPayload(
          submittedValidation.error.code,
          submittedValidation.error.message,
          {
            phase: submittedValidation.error.phase,
            ...(submittedValidation.error.digest
              ? { digest: submittedValidation.error.digest }
              : {}),
          },
        ),
      );
    }

    signedTransaction = { ...pendingTransaction, submittedDigest };
    state = {
      type: 'awaiting_finalized',
      digest: submittedDigest,
      chain: {
        type: 'digest_known',
        bytes: pendingTransaction.bytes,
        signature: '',
        digest: submittedDigest,
      },
      delivery: { type: 'open' },
    };
    authority.sendAck(session, message, 'sign.submitted.ack', {
      digest: submittedDigest,
      ackSequence: message.sequence,
    });
    startFinalityTimeout(submittedDigest);
    onEvent({
      variant: 'info',
      message: 'Transaction submitted',
    });
  };

  const handleFinalized = async (message: ProtocolEnvelope<'sign.finalized'>) => {
    clearFinalityTimer?.();
    if (
      state.type !== 'awaiting_finalized' ||
      !signedTransaction?.submittedDigest
    ) {
      throw new ProtocolMessageError(
        createSignProtocolErrorPayload({
          code: 'invalid_payload',
          message: 'Sign finalization has no submitted transaction',
          phase: 'finality',
          digest: message.payload.digest,
        }),
      );
    }

    const finalizedValidation = deps.validateFinalizedDigest({
      submittedDigest: signedTransaction.submittedDigest,
      finalizedDigest: message.payload.digest,
    });
    if (!finalizedValidation.ok) {
      throw new ProtocolMessageError(
        createProtocolErrorPayload(
          finalizedValidation.error.code,
          finalizedValidation.error.message,
          {
            phase: finalizedValidation.error.phase,
            ...(finalizedValidation.error.digest
              ? { digest: finalizedValidation.error.digest }
              : {}),
          },
        ),
      );
    }

    const { rawEffects } = await authority.postSubmitObservation(() =>
      waitForWalrusConnectTransaction(client, {
        digest: message.payload.digest,
        timeout: timeouts.finalityMs,
      }),
    );
    if (isTerminal() || !session?.isActive()) return;

    const verifiedEffects = deps.encodeBytes(rawEffects);
    if (message.payload.effects !== verifiedEffects) {
      throw new ProtocolMessageError(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: 'Finalized transaction effects do not match chain result',
          phase: 'finality',
          digest: message.payload.digest,
        }),
      );
    }

    suppressCloseWarning = true;
    authority.sendAck(session, message, 'sign.finalized.ack', {
      digest: message.payload.digest,
      ackSequence: message.sequence,
    });
    markTerminal('success');
    session.markTerminal('success');
    closeAfterFallback();
    onEvent({
      variant: 'success',
      message: 'Transaction executed',
    });
  };

  const handleTransaction = async (
    message: ProtocolEnvelope<'sign.transaction'>,
  ) => {
    clearProposalTimer?.();
    state = {
      type: 'validating_transaction',
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
    };
    const { bytes, expectedDigest } = message.payload;
    const tx = deps.createTransactionFromBytes(deps.decodeBytes(bytes));
    authority.assertCancellable();

    const senderError = deps.getTransactionSenderValidationError(
      tx,
      signer.getAddress(),
    );
    if (senderError) {
      throwProtocolValidationError(senderError, 'validate_sender');
    }

    await authority.cancellable(() =>
      deps.validateExpectedDigest(tx, client, expectedDigest),
    );
    if (isTerminal() || !session?.isActive()) return;

    const reviewResult = await authority.cancellable(() =>
      deps.createSignTransactionReview({
        tx,
        client: reviewClient,
        bytes,
        digest: expectedDigest,
        network,
      }),
    );
    if ('error' in reviewResult) {
      throwProtocolValidationError(reviewResult.error, 'dry_run');
    }
    const review = 'review' in reviewResult ? reviewResult.review : undefined;
    if (review === undefined) {
      throw new ProtocolMessageError(
        createProtocolErrorPayload(
          'transaction_validation_failed',
          'Transaction review was not created',
          { phase: 'dry_run' },
        ),
      );
    }
    const approvedReview = review;

    signedTransaction = {
      tx,
      bytes,
      expectedDigest,
    };
    state = {
      type: 'reviewing_transaction',
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
    };
    const approvalResult = await authority.cancellable(() =>
      deps.approveSignTransactionReview(
        approvedReview,
        signer.reviewTransaction,
      ),
    );
    if (isTerminal() || !session?.isActive()) return;
    if ('error' in approvalResult) {
      throwProtocolValidationError(approvalResult.error, 'review');
    }

    state = {
      type: 'signing',
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
    };
    const freshness = validateProtocolMessageFresh(message);
    if (!freshness.ok) {
      throwProtocolValidationError(freshness.error, 'sign');
    }

    const { bytes: signedBytes, signature } = await authority.cancellable(() =>
      signer.signTransaction(tx),
    );
    if (isTerminal() || !session?.isActive()) return;
    if (signedBytes !== bytes) {
      throw new ProtocolMessageError(
        createProtocolErrorPayload(
          'transaction_validation_failed',
          'Signed transaction bytes do not match request',
        ),
      );
    }

    state = {
      type: 'awaiting_submitted',
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
    };
    startSubmissionTimeout();
    sendProtocol('sign.response', { signature });
  };

  session = new ProtocolSession({
    sessionId,
    network,
    transport,
    codec: protocolCodec,
    onMessage: async (message) => {
      let currentPhase: SignProtocolPhase = 'transaction_proposal';
      try {
        if (isTerminal() || localProtocolErrorRequested) return;

        const expectedTypes: readonly ProtocolMessageType[] =
          state.type === 'awaiting_transaction'
            ? ['sign.transaction', 'protocol.error']
            : state.type === 'awaiting_submitted'
              ? ['sign.submitted', 'protocol.error']
              : state.type === 'awaiting_finalized'
                ? ['sign.finalized', 'protocol.error']
                : ['protocol.error'];
        if (!expectedTypes.includes(message.type)) {
          throw new ProtocolMessageError(
            createProtocolErrorPayload(
              'type_mismatch',
              'Unexpected sign protocol message',
            ),
          );
        }

        if (isProtocolErrorMessage(message)) {
          handleRemoteTerminal(message);
          return;
        }

        if (message.type === 'sign.submitted') {
          currentPhase = 'submitted';
          await handleSubmitted(message);
          return;
        }

        if (message.type === 'sign.finalized') {
          currentPhase = 'finality';
          await handleFinalized(message);
          return;
        }

        if (message.type === 'sign.transaction') {
          currentPhase = 'validate_sender';
          await handleTransaction(message);
          return;
        }

        throw new ProtocolMessageError(
          createProtocolErrorPayload(
            'type_mismatch',
            'Unexpected sign protocol message',
          ),
        );
      } catch (error) {
        if (isTerminal() || error instanceof EffectAuthorityTerminatedError) {
          return;
        }
        const submittedDigest =
          state.type === 'awaiting_finalized' ? state.digest : undefined;
        const errorPayload =
          error instanceof ProtocolMessageError
            ? error.payload
            : protocolErrorFromUnknown({
                error,
                phase: currentPhase,
                fallbackMessage:
                  state.type === 'awaiting_submitted' ||
                  state.type === 'awaiting_finalized'
                    ? 'Failed to confirm signed transaction'
                    : 'Failed to validate sign transaction',
                digest: submittedDigest,
              });
        closeWithLocalError(errorPayload);
      }
    },
    onError: (error) => {
      if (isTerminal() || localProtocolErrorRequested) return;
      closeWithLocalError(
        error instanceof ProtocolMessageError
          ? error.payload
          : createSignProtocolErrorPayload({
              code: 'internal_error',
              message: `Invalid sign protocol message: ${getErrorMessage(error)}`,
              phase: 'transaction_proposal',
            }),
      );
    },
    onClose: (reason) => {
      const closeState = state;
      markTerminal(reason);
      if (
        suppressCloseWarning ||
        reason === 'success' ||
        reason === 'local_closed'
      ) {
        return;
      }
      if (
        closeState.type === 'awaiting_transaction' ||
        closeState.type === 'validating_transaction' ||
        closeState.type === 'reviewing_transaction' ||
        closeState.type === 'signing'
      ) {
        onEvent({
          variant: 'error',
          message: 'Connection closed before transaction proposal.',
        });
        return;
      }
      if (closeState.type === 'awaiting_submitted') {
        onEvent({
          variant: 'error',
          message: 'Connection closed before transaction submission.',
        });
        return;
      }
      onEvent({
        variant: 'error',
        message: 'Connection closed before transaction finalization.',
      });
    },
  });

  state = {
    type: 'awaiting_transaction',
    chain: { type: 'no_submit' },
    delivery: { type: 'open' },
  };
  startProposalTimeout();
  sendProtocol('sign.address', { address: signer.getAddress() });

  const cancel = (reason = 'User closed') => {
    if (isTerminal()) return;
    closeWithLocalError(
      createSignProtocolErrorPayload({
        code: 'transaction_rejected',
        message: reason,
        phase:
          state.type === 'awaiting_finalized'
            ? 'finality'
            : state.type === 'awaiting_submitted'
              ? 'submitted'
              : 'transaction_proposal',
        ...(state.type === 'awaiting_finalized'
          ? { digest: state.digest }
          : {}),
      }),
    );
  };

  return {
    session,
    cancel,
    dispose: () => {
      suppressCloseWarning = true;
      clearAllTimeouts();
      clearCloseFallbackTimeout();
      authority.cancel('cancelled');
      markTerminal('disposed');
      session.dispose();
    },
    getState: () => state,
  };
};
