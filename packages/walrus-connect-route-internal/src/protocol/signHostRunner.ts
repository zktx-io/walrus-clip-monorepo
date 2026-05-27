import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';

import { EffectAuthority, EffectAuthorityTerminatedError } from './effectAuthority';
import {
  QRSignOutcomeError,
  createSignHostFailureOutcome,
  formatQRSignOutcome,
  initialSignHostLifecycleState,
  signOutcomeToResult,
  type QRSignOutcome,
  type QRSignResult,
  type SignChainFact,
  type SignDeliveryFact,
  type SignHostLifecycleState,
} from './signLifecycle';
import {
  getErrorMessage,
  protocolCodec,
  protocolErrorFromUnknown,
  throwProtocolValidationError,
  verifyPendingTransactionSignature,
} from './signRuntime';
import {
  ProtocolSession,
  type ProtocolSessionTerminalReason,
  type ProtocolTransport,
} from './session';
import type { NETWORK, NotiVariant } from '../types';
import {
  createProtocolErrorPayload,
  formatProtocolError,
  isProtocolErrorMessage,
  ProtocolMessageError,
  type ProtocolEnvelope,
  type ProtocolErrorPayload,
} from '../utils/message';
import { normalizeSignTransactionAddress } from '../utils/signTransactionReview';
import {
  ACK_TIMEOUT_MS,
  FINALITY_TIMEOUT_MS,
  SIGN_RESPONSE_TIMEOUT_MS,
  createSignProtocolErrorPayload,
  requirePendingSignTransaction,
  type PendingSignTransaction,
  type SignProtocolPhase,
} from '../utils/signProtocol';
import {
  buildWalrusConnectTransaction,
  createWalrusConnectGrpcClient,
  executeWalrusConnectTransaction,
  waitForWalrusConnectTransaction,
  type WalrusConnectGrpcClient,
} from '../utils/suiClient';

export type { QRSignOutcome, QRSignResult } from './signLifecycle';
export {
  QRSignOutcomeError,
  formatQRSignOutcome as formatSignHostOutcome,
  signOutcomeToResult as signHostOutcomeToResult,
};

export type SignHostOutcome = QRSignOutcome;

type SignHostClient = WalrusConnectGrpcClient;

type SignHostTransaction = {
  setSenderIfNotSet: (address: string) => void;
  build: (input: { client: SignHostClient }) => Promise<Uint8Array>;
};

export type SignHostRunnerDeps = {
  createClient: (network: NETWORK) => SignHostClient;
  createTransactionFromJson: (json: string) => SignHostTransaction;
  encodeBytes: (bytes: Uint8Array) => string;
  verifyPendingTransactionSignature: typeof verifyPendingTransactionSignature;
};

export type SignHostRunnerTimeouts = {
  signResponseMs: number;
  ackMs: number;
  finalityMs: number;
};

export type StartSignHostRunnerParams = {
  sessionId: string;
  network: NETWORK;
  transport: ProtocolTransport;
  transaction: { toJSON: () => Promise<string> };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onFinish: (outcome: QRSignOutcome) => void;
  deps?: Partial<SignHostRunnerDeps>;
  timeouts?: Partial<SignHostRunnerTimeouts>;
};

const defaultDeps: SignHostRunnerDeps = {
  createClient: createWalrusConnectGrpcClient,
  createTransactionFromJson: (json) => Transaction.from(json),
  encodeBytes: toBase64,
  verifyPendingTransactionSignature,
};

const defaultTimeouts: SignHostRunnerTimeouts = {
  signResponseMs: SIGN_RESPONSE_TIMEOUT_MS,
  ackMs: ACK_TIMEOUT_MS,
  finalityMs: FINALITY_TIMEOUT_MS,
};

const rawEffectsToBase64 = (
  rawEffects: Uint8Array,
  encodeBytes: (bytes: Uint8Array) => string,
) => encodeBytes(rawEffects);

const normalizeSignerAddressOrThrow = (address: string): string => {
  const normalizedSigner = normalizeSignTransactionAddress(address);
  if (normalizedSigner.ok === true) return normalizedSigner.address;

  return throwProtocolValidationError(normalizedSigner.error, 'address');
};

const chainFromOutcome = (outcome: QRSignOutcome): SignChainFact => {
  if (outcome.type === 'failed_before_submit') return { type: 'no_submit' };
  if (outcome.type === 'execute_result_unknown') {
    return {
      type: 'execute_unknown',
      bytes: outcome.bytes,
      signature: outcome.signature,
      reason: outcome.reason,
    };
  }
  if (outcome.type === 'submitted_finality_unknown') {
    return {
      type: 'finality_unknown',
      bytes: outcome.bytes,
      signature: outcome.signature,
      digest: outcome.digest,
      reason: outcome.reason,
    };
  }
  if (
    outcome.type === 'signed_and_finalized' ||
    outcome.type === 'finalized_delivery_failed'
  ) {
    return {
      type: 'finality_known',
      bytes: outcome.bytes,
      signature: outcome.signature,
      digest: outcome.digest,
      effects: outcome.effects,
    };
  }
  return {
    type: 'digest_known',
    bytes: outcome.bytes,
    signature: outcome.signature,
    digest: outcome.digest,
  };
};

const deliveryFromOutcome = (outcome: QRSignOutcome): SignDeliveryFact => {
  if (outcome.type === 'signed_and_finalized') return { type: 'closed', reason: 'success' };
  if (outcome.type === 'failed_before_submit') {
    return { type: 'closed', reason: outcome.reason };
  }
  return { type: 'closed', reason: outcome.reason };
};

const isPreSubmitState = (state: SignHostLifecycleState) =>
  state.type === 'awaiting_address' ||
  state.type === 'building_transaction' ||
  state.type === 'awaiting_signature' ||
  state.type === 'verifying_signature';

export const startSignHostRunner = ({
  sessionId,
  network,
  transport,
  transaction,
  onEvent,
  onFinish,
  deps: partialDeps,
  timeouts: partialTimeouts,
}: StartSignHostRunnerParams): {
  session: ProtocolSession;
  cancel: (reason?: string) => void;
  dispose: () => void;
  getState: () => SignHostLifecycleState;
} => {
  const deps = { ...defaultDeps, ...partialDeps };
  const timeouts = { ...defaultTimeouts, ...partialTimeouts };
  const client = deps.createClient(network);
  const authority = new EffectAuthority();

  let state: SignHostLifecycleState = initialSignHostLifecycleState();
  let session: ProtocolSession;
  let finished = false;
  let clearSignResponseTimer: (() => void) | undefined;
  let deliveryClosed = false;
  let deliveryFailureReason: string | undefined;
  let suppressCloseSettlement = false;

  const clearSignResponseTimeout = () => {
    clearSignResponseTimer?.();
    clearSignResponseTimer = undefined;
  };

  const settle = (outcome: QRSignOutcome) => {
    if (finished) return;
    finished = true;
    clearSignResponseTimeout();
    authority.terminate('completed');
    state = {
      type: 'terminal',
      chain: chainFromOutcome(outcome),
      delivery: deliveryFromOutcome(outcome),
      publicSettlement: { type: 'settled', outcome },
    };
    onFinish(outcome);
  };

  const sendProtocolErrorAndClose = async (payload: ProtocolErrorPayload) => {
    if (!session.isActive()) return false;
    suppressCloseSettlement = true;
    try {
      await session.sendAndWaitForAck({
        type: 'protocol.error',
        payload,
        expectedAckType: 'protocol.error.ack',
        timeoutMs: timeouts.ackMs,
        closeOnAck: true,
        validateAck: (message) => message.payload.code === payload.code,
      });
      return true;
    } catch {
      try {
        session.close('protocol_error');
      } catch {}
      return false;
    } finally {
      suppressCloseSettlement = false;
    }
  };

  const failBeforeSubmit = async (payload: ProtocolErrorPayload) => {
    if (finished || !authority.isActive()) return;
    const reason = formatProtocolError(payload);
    clearSignResponseTimeout();
    await sendProtocolErrorAndClose(payload);
    settle({
      type: 'failed_before_submit',
      reason,
    });
  };

  const settleFailedBeforeSubmit = (reason: string) => {
    if (finished) return;
    clearSignResponseTimeout();
    settle({ type: 'failed_before_submit', reason });
  };

  const settleFailureFromCurrentState = (reason: string) => {
    const outcome = createSignHostFailureOutcome(state, reason);
    if (!outcome) return false;
    settle(outcome);
    return true;
  };

  const finishDeliveryLost = (reason: string) => {
    if (finished) return;

    if (state.type === 'executing') {
      deliveryClosed = true;
      deliveryFailureReason = reason;
      return;
    }

    if (state.type === 'awaiting_submitted_ack') {
      settleFailureFromCurrentState(reason);
      return;
    }

    if (state.type === 'awaiting_finality') {
      deliveryClosed = true;
      deliveryFailureReason = reason;
      return;
    }

    if (state.type === 'awaiting_finalized_ack') {
      settleFailureFromCurrentState(reason);
    }
  };

  const handleRemoteTerminal = (payload: ProtocolErrorPayload) => {
    clearSignResponseTimeout();
    deliveryClosed = true;
    deliveryFailureReason = formatProtocolError(payload);
    authority.cancel('protocol_error');

    if (isPreSubmitState(state)) {
      settle({
        type: 'failed_before_submit',
        reason: deliveryFailureReason,
      });
      return;
    }

    finishDeliveryLost(deliveryFailureReason);
  };

  const handleSessionClose = (reason: ProtocolSessionTerminalReason) => {
    if (finished || suppressCloseSettlement) return;
    clearSignResponseTimeout();

    if (
      reason === 'ack_timeout' &&
      (state.type === 'awaiting_submitted_ack' ||
        state.type === 'awaiting_finalized_ack')
    ) {
      return;
    }

    deliveryClosed = true;
    deliveryFailureReason ??=
      reason === 'remote_closed' ||
      reason === 'local_closed' ||
      reason === 'transport_error'
        ? 'Connection closed before protocol delivery completed.'
        : `Connection closed: ${reason}`;

    authority.cancel(
      reason === 'remote_closed'
        ? 'remote_closed'
        : reason === 'transport_error'
          ? 'transport_error'
          : 'local_closed',
    );

    if (state.type === 'executing') return;

    if (isPreSubmitState(state)) {
      settleFailedBeforeSubmit(
        state.type === 'awaiting_address'
          ? 'Connection closed before signer address was received.'
          : 'Connection closed before transaction submission.',
      );
      return;
    }

    finishDeliveryLost(deliveryFailureReason);
  };

  const startSignResponseTimeout = () => {
    clearSignResponseTimeout();
    clearSignResponseTimer = authority.setTimeout(() => {
      if (state.type !== 'awaiting_signature') return;
      void failBeforeSubmit(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: 'Timed out waiting for sign response',
          phase: 'sign_response',
        }),
      );
    }, timeouts.signResponseMs);
  };

  const sendSubmitted = async (digest: string) => {
    if (deliveryClosed || !session.isActive()) return false;
    try {
      await session.sendAndWaitForAck({
        type: 'sign.submitted',
        payload: { digest },
        expectedAckType: 'sign.submitted.ack',
        timeoutMs: timeouts.ackMs,
        validateAck: (ack) =>
          ack.type === 'sign.submitted.ack' && ack.payload.digest === digest,
      });
      return true;
    } catch {
      return false;
    }
  };

  const sendFinalized = async (digest: string, effects: string) => {
    if (deliveryClosed || !session.isActive()) return false;
    try {
      await session.sendAndWaitForAck({
        type: 'sign.finalized',
        payload: { digest, effects },
        expectedAckType: 'sign.finalized.ack',
        timeoutMs: timeouts.ackMs,
        validateAck: (ack) =>
          ack.type === 'sign.finalized.ack' && ack.payload.digest === digest,
      });
      return true;
    } catch {
      return false;
    }
  };

  const settleExecuteUnknown = async ({
    pending,
    signature,
    digest,
    phase,
    error,
  }: {
    pending: PendingSignTransaction;
    signature: string;
    digest?: string;
    phase: SignProtocolPhase;
    error: unknown;
  }) => {
    const reason = `Transaction execution result is unknown: ${getErrorMessage(error)}`;
    if (!deliveryClosed && session.isActive()) {
      await sendProtocolErrorAndClose(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: reason,
          phase,
          ...(digest ? { digest } : {}),
        }),
      );
    }

    settle({
      type: 'execute_result_unknown',
      bytes: pending.bytes,
      signature,
      ...(digest ? { digest } : {}),
      reason,
    });
  };

  const completeSubmittedTransaction = async ({
    pending,
    signature,
    digest,
  }: {
    pending: PendingSignTransaction;
    signature: string;
    digest: string;
  }) => {
    if (finished) return;
    state = {
      type: 'awaiting_submitted_ack',
      pending,
      signature,
      digest,
      chain: { type: 'digest_known', bytes: pending.bytes, signature, digest },
      delivery: { type: 'submitted_ack_pending', digest },
      publicSettlement: { type: 'unresolved' },
    };
    if (deliveryClosed || !session.isActive()) {
      settleFailureFromCurrentState(
        deliveryFailureReason ??
          'Connection closed before protocol delivery completed.',
      );
      return;
    }

    onEvent({ variant: 'info', message: 'Transaction submitted' });
    const submittedDelivered = await sendSubmitted(digest);
    if (finished) return;
    if (!submittedDelivered) {
      finishDeliveryLost(
        deliveryFailureReason ??
          'Transaction was submitted, but delivery confirmation failed.',
      );
      return;
    }

    state = {
      type: 'awaiting_finality',
      pending,
      signature,
      digest,
      chain: { type: 'digest_known', bytes: pending.bytes, signature, digest },
      delivery: { type: 'open' },
      publicSettlement: { type: 'unresolved' },
    };

    let rawEffects: Uint8Array;
    try {
      ({ rawEffects } = await authority.postSubmitObservation(() =>
        waitForWalrusConnectTransaction(client, {
          digest,
          timeout: timeouts.finalityMs,
        }),
      ));
    } catch (error) {
      if (finished) return;
      const reason = `Transaction was submitted, but finality was not confirmed: ${getErrorMessage(error)}`;
      await sendProtocolErrorAndClose(
        createSignProtocolErrorPayload({
          code: 'transaction_failed',
          message: reason,
          phase: 'finality',
          digest,
        }),
      );
      settleFailureFromCurrentState(reason);
      return;
    }

    if (finished) return;
    const effects = rawEffectsToBase64(rawEffects, deps.encodeBytes);
    state = {
      type: 'awaiting_finalized_ack',
      pending,
      signature,
      digest,
      effects,
      chain: {
        type: 'finality_known',
        bytes: pending.bytes,
        signature,
        digest,
        effects,
      },
      delivery: { type: 'finalized_ack_pending', digest },
      publicSettlement: { type: 'unresolved' },
    };
    if (deliveryClosed || !session.isActive()) {
      settleFailureFromCurrentState(
        deliveryFailureReason ??
          'Transaction was finalized, but finalization delivery failed.',
      );
      return;
    }

    const finalizedDelivered = await sendFinalized(digest, effects);
    if (finished) return;
    if (!finalizedDelivered) {
      finishDeliveryLost(
        deliveryFailureReason ??
          'Transaction was finalized, but finalization delivery failed.',
      );
      return;
    }

    settle({
      type: 'signed_and_finalized',
      bytes: pending.bytes,
      signature,
      digest,
      effects,
    });
    session.close('success');
  };

  const handleAddress = async (message: ProtocolEnvelope<'sign.address'>) => {
    const signerAddress = normalizeSignerAddressOrThrow(message.payload.address);
    state = {
      type: 'building_transaction',
      signerAddress,
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
      publicSettlement: { type: 'unresolved' },
    };
    onEvent({ variant: 'info', message: 'Creating transaction...' });

    const txJson = await authority.cancellable(() => transaction.toJSON());
    const txb = deps.createTransactionFromJson(txJson);
    authority.assertCancellable();
    txb.setSenderIfNotSet(signerAddress);

    const txBytes = await authority.cancellable(() =>
      buildWalrusConnectTransaction({ client, transaction: txb }),
    );
    const bytes = deps.encodeBytes(txBytes);
    const pending = {
      bytes,
      rawBytes: txBytes,
      signerAddress,
    };
    state = {
      type: 'awaiting_signature',
      pending,
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
      publicSettlement: { type: 'unresolved' },
    };
    startSignResponseTimeout();
    authority.send(session, 'sign.transaction', { bytes });
  };

  const handleSignResponse = async (
    message: ProtocolEnvelope<'sign.response'>,
  ) => {
    clearSignResponseTimeout();
    const pendingResult = requirePendingSignTransaction(
      state.type === 'awaiting_signature' ? state.pending : undefined,
    );
    let pending: PendingSignTransaction;
    if ('pendingTransaction' in pendingResult) {
      pending = pendingResult.pendingTransaction;
    } else {
      throw new ProtocolMessageError(
        createProtocolErrorPayload(
          pendingResult.error.code,
          pendingResult.error.message,
          {
            phase: pendingResult.error.phase,
          },
        ),
      );
    }

    const { signature } = message.payload;
    state = {
      type: 'verifying_signature',
      pending,
      signature,
      chain: { type: 'no_submit' },
      delivery: { type: 'open' },
      publicSettlement: { type: 'unresolved' },
    };
    onEvent({ variant: 'info', message: 'Executing transaction...' });
    await authority.cancellable(() =>
      deps.verifyPendingTransactionSignature({
        pendingTransaction: pending,
        signature,
        network,
      }),
    );

    state = {
      type: 'executing',
      pending,
      signature,
      chain: {
        type: 'execute_in_flight',
        bytes: pending.bytes,
        signature,
      },
      delivery: { type: 'open' },
      publicSettlement: { type: 'unresolved' },
    };

    if (!pending.rawBytes) {
      throw new ProtocolMessageError(
        createSignProtocolErrorPayload({
          code: 'invalid_payload',
          message: 'Sign response has no raw transaction bytes',
          phase: 'execute',
        }),
      );
    }
    const rawBytes = pending.rawBytes;
    let digest: string;
    try {
      ({ digest } = await authority.irreversibleExecute(() =>
        executeWalrusConnectTransaction(client, {
          bytes: rawBytes,
          signature,
        }),
      ));
    } catch (error) {
      await settleExecuteUnknown({ pending, signature, phase: 'execute', error });
      return;
    }
    await completeSubmittedTransaction({ pending, signature, digest });
  };

  const handleMessage = async (message: ProtocolEnvelope) => {
    if (finished) return;

    if (isProtocolErrorMessage(message)) {
      authority.trySendTerminalAck(session, message, {
        code: message.payload.code,
        ackSequence: message.sequence,
      });
      handleRemoteTerminal(message.payload);
      return;
    }

    let currentPhase: SignProtocolPhase =
      state.type === 'awaiting_address' ? 'address' : 'signature_verify';
    try {
      if (state.type === 'awaiting_address' && message.type === 'sign.address') {
        currentPhase = 'build';
        await handleAddress(message);
        return;
      }

      if (
        state.type === 'awaiting_signature' &&
        message.type === 'sign.response'
      ) {
        currentPhase = 'signature_verify';
        await handleSignResponse(message);
        return;
      }

      throw new ProtocolMessageError(
        createProtocolErrorPayload(
          'type_mismatch',
          'Unexpected sign protocol message',
        ),
      );
    } catch (error) {
      if (finished || error instanceof EffectAuthorityTerminatedError) return;

      if (state.type === 'executing') {
        await settleExecuteUnknown({
          pending: state.pending,
          signature: state.signature,
          phase: 'execute',
          error,
        });
        return;
      }

      if (
        state.type === 'awaiting_submitted_ack' ||
        state.type === 'awaiting_finality' ||
        state.type === 'awaiting_finalized_ack'
      ) {
        const errorPayload =
          error instanceof ProtocolMessageError
            ? error.payload
            : protocolErrorFromUnknown({
                error,
                phase: currentPhase,
                fallbackMessage: 'Failed after transaction submission',
                digest: state.digest,
              });
        settleFailureFromCurrentState(formatProtocolError(errorPayload));
        return;
      }

      const errorPayload =
        error instanceof ProtocolMessageError
          ? error.payload
          : protocolErrorFromUnknown({
              error,
              phase: currentPhase,
              fallbackMessage: 'Failed to handle sign protocol message',
            });

      await failBeforeSubmit(errorPayload);
    }
  };

  session = new ProtocolSession({
    sessionId,
    network,
    transport,
    codec: protocolCodec,
    onMessage: handleMessage,
    onError: (error) => {
      if (finished) return;
      const payload =
        error instanceof ProtocolMessageError
          ? error.payload
          : createSignProtocolErrorPayload({
              code: 'internal_error',
              message: `Invalid sign protocol message: ${getErrorMessage(error)}`,
              phase: 'address',
            });
      const reason = formatProtocolError(payload);

      if (isPreSubmitState(state)) {
        void failBeforeSubmit(payload);
        return;
      }

      deliveryClosed = true;
      deliveryFailureReason = reason;
      finishDeliveryLost(reason);
      session.close('protocol_error');
    },
    onClose: handleSessionClose,
  });

  const cancel = (reason = 'User closed') => {
    if (finished) return;

    if (isPreSubmitState(state)) {
      settleFailedBeforeSubmit(reason);
      try {
        session.close('local_closed');
      } catch {}
      return;
    }

    deliveryClosed = true;
    deliveryFailureReason = reason;
    authority.cancel('cancelled');
    try {
      session.close('local_closed');
    } catch {}
    finishDeliveryLost(reason);
  };

  return {
    session,
    cancel,
    dispose: () => {
      cancel('Sign session disposed');
      session.dispose();
    },
    getState: () => state,
  };
};

export { formatQRSignOutcome, signOutcomeToResult };
