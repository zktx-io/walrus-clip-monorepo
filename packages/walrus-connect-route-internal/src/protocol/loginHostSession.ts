import {
  publicKeyFromSuiBytes,
  verifyPersonalMessageSignature,
} from '@mysten/sui/verify';

import { EffectAuthority, EffectAuthorityTerminatedError } from './effectAuthority';
import { createPeerDataConnectionTransport } from './peerTransport';
import {
  ProtocolSession,
  type ProtocolSessionTerminalReason,
  type ProtocolTransport,
} from './session';
import type { NETWORK, NotiVariant } from '../types';
import {
  createProtocolErrorPayload,
  createProtocolMessage,
  formatProtocolError,
  isProtocolErrorMessage,
  parseProtocolMessage,
  ProtocolMessageError,
  type ProtocolEnvelope,
  type ProtocolErrorPayload,
} from '../utils/message';
import { ACK_TIMEOUT_MS, CLOSE_FALLBACK_TIMEOUT_MS } from '../utils/signProtocol';
import { createWalrusConnectGraphQLClient } from '../utils/suiClient';

export type LoginHostOutcome =
  | { type: 'connected'; address: string; network: NETWORK }
  | {
      type: 'result_delivery_failed';
      address: string;
      network: NETWORK;
      reason: string;
    }
  | { type: 'failed'; reason: string };

export type QRLoginOutcome = LoginHostOutcome;

type LoginHostState =
  | { type: 'awaitingProof' }
  | { type: 'verifyingProof' }
  | { type: 'awaitingResultAck'; result: { address: string; network: NETWORK } }
  | { type: 'terminal'; outcome: LoginHostOutcome };

export type LoginHostSessionDeps = {
  createClient: typeof createWalrusConnectGraphQLClient;
  verifyPersonalMessageSignature: typeof verifyPersonalMessageSignature;
  publicKeyFromSuiBytes: typeof publicKeyFromSuiBytes;
};

export type StartLoginHostSessionParams = {
  sessionId: string;
  network: NETWORK;
  challenge: string;
  transport: ProtocolTransport;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onFinish: (outcome: LoginHostOutcome) => void;
  deps?: Partial<LoginHostSessionDeps>;
  ackTimeoutMs?: number;
  closeFallbackMs?: number;
};

const defaultDeps: LoginHostSessionDeps = {
  createClient: createWalrusConnectGraphQLClient,
  verifyPersonalMessageSignature,
  publicKeyFromSuiBytes,
};

const loginHostOutcomeMessage = (outcome: LoginHostOutcome) =>
  outcome.type === 'connected'
    ? 'Verification success'
    : outcome.type === 'result_delivery_failed'
      ? outcome.reason
      : outcome.reason;

export const formatLoginHostOutcome = loginHostOutcomeMessage;

export const loginHostOutcomeToResult = (
  outcome: LoginHostOutcome,
): { address: string; network: NETWORK } | undefined =>
  outcome.type === 'connected'
    ? { address: outcome.address, network: outcome.network }
    : undefined;

export class LoginHostOutcomeError extends Error {
  readonly outcome: LoginHostOutcome;

  constructor(outcome: LoginHostOutcome) {
    super(loginHostOutcomeMessage(outcome));
    this.name = 'LoginHostOutcomeError';
    this.outcome = outcome;
  }
}

export const startLoginHostSession = ({
  sessionId,
  network,
  challenge,
  transport,
  onEvent,
  onFinish,
  deps: partialDeps,
  ackTimeoutMs = ACK_TIMEOUT_MS,
  closeFallbackMs = CLOSE_FALLBACK_TIMEOUT_MS,
}: StartLoginHostSessionParams): {
  session: ProtocolSession;
  cancel: (reason?: string) => void;
  dispose: () => void;
  getState: () => LoginHostState;
} => {
  const deps = { ...defaultDeps, ...partialDeps };
  const authority = new EffectAuthority();
  let state: LoginHostState = { type: 'awaitingProof' };
  let finished = false;
  let failureReason: string | undefined;
  let closeFallbackTimeout: ReturnType<typeof setTimeout> | undefined;
  let session: ProtocolSession;

  const clearCloseFallbackTimeout = () => {
    if (closeFallbackTimeout) clearTimeout(closeFallbackTimeout);
    closeFallbackTimeout = undefined;
  };

  const closeAfterFallback = (
    reason: ProtocolSessionTerminalReason = 'protocol_error',
  ) => {
    clearCloseFallbackTimeout();
    closeFallbackTimeout = setTimeout(() => {
      try {
        session.close(reason);
      } catch {}
    }, closeFallbackMs);
  };

  const setTerminal = (outcome: LoginHostOutcome) => {
    if (finished) return;
    finished = true;
    clearCloseFallbackTimeout();
    authority.terminate('completed');
    state = { type: 'terminal', outcome };
    onFinish(outcome);
  };

  const settleFailedOrResultDeliveryFailed = (reason: string) => {
    if (state.type === 'awaitingResultAck') {
      setTerminal({
        type: 'result_delivery_failed',
        ...state.result,
        reason,
      });
      return;
    }

    setTerminal({ type: 'failed', reason });
  };

  const fail = async (payload: ProtocolErrorPayload) => {
    if (finished || !authority.isActive()) return;
    const reason = formatProtocolError(payload);
    failureReason = reason;
    if (session.isActive()) {
      try {
        await authority.sendAndWaitForAck(session, {
          type: 'protocol.error',
          payload,
          expectedAckType: 'protocol.error.ack',
          timeoutMs: ackTimeoutMs,
          closeOnAck: true,
          validateAck: (message) => message.payload.code === payload.code,
        });
      } catch {}
    }
    settleFailedOrResultDeliveryFailed(reason);
  };

  const handleRemoteError = (message: ProtocolEnvelope<'protocol.error'>) => {
    const reason = formatProtocolError(message.payload);
    failureReason = reason;
    authority.trySendTerminalAck(session, message, {
      code: message.payload.code,
      ackSequence: message.sequence,
    });
    settleFailedOrResultDeliveryFailed(reason);
    closeAfterFallback('protocol_error');
  };

  const verifyProof = async (message: ProtocolEnvelope<'login.proof'>) => {
    state = { type: 'verifyingProof' };
    onEvent({ variant: 'info', message: 'Verifying...' });

    if (message.payload.challenge !== challenge) {
      await fail(
        createProtocolErrorPayload(
          'invalid_challenge',
          'Login challenge does not match this session',
        ),
      );
      return;
    }

    const client = deps.createClient(network);
    const { address, publicKey, signature } = message.payload;
    const bytesMessage = new TextEncoder().encode(challenge);
    const payloadPublicKey = await authority.cancellable(() =>
      deps.publicKeyFromSuiBytes(publicKey, {
        address,
        client,
      }),
    );
    const verifiedPublicKey = await authority.cancellable(() =>
      deps.verifyPersonalMessageSignature(bytesMessage, signature, {
        address,
        client,
      }),
    );

    const publicKeyMatches =
      payloadPublicKey.toSuiPublicKey() === verifiedPublicKey.toSuiPublicKey();

    if (!publicKeyMatches) {
      await fail(
        createProtocolErrorPayload(
          'verification_failed',
          'Login proof verification failed',
        ),
      );
      return;
    }

    const result = { address, network };
    state = { type: 'awaitingResultAck', result };
    await authority.sendAndWaitForAck(session, {
      type: 'login.result',
      payload: {
        accepted: true,
        address,
      },
      expectedAckType: 'login.result.ack',
      timeoutMs: ackTimeoutMs,
      closeOnAck: true,
      validateAck: (ack) => ack.payload.accepted === true,
    });

    onEvent({ variant: 'success', message: 'Verification success' });
    setTerminal({ type: 'connected', address, network });
  };

  const handleMessage = async (message: ProtocolEnvelope) => {
    if (finished || !authority.isActive()) return;

    if (isProtocolErrorMessage(message)) {
      handleRemoteError(message);
      return;
    }

    try {
      if (state.type !== 'awaitingProof' || message.type !== 'login.proof') {
        throw new ProtocolMessageError(
          createProtocolErrorPayload(
            'type_mismatch',
            'Unexpected login protocol message',
          ),
        );
      }

      await verifyProof(message);
    } catch (error) {
      if (
        finished ||
        !authority.isActive() ||
        error instanceof EffectAuthorityTerminatedError
      ) {
        return;
      }

      if (state.type === 'awaitingResultAck') {
        setTerminal({
          type: 'result_delivery_failed',
          ...state.result,
          reason:
            error instanceof Error
              ? error.message
              : 'Connection closed before login acknowledgement.',
        });
        return;
      }

      await fail(
        error instanceof ProtocolMessageError
          ? error.payload
          : createProtocolErrorPayload(
              'verification_failed',
              'Failed to verify login proof',
            ),
      );
    }
  };

  const handleClose = (reason: ProtocolSessionTerminalReason) => {
    if (reason === 'ack_timeout' && state.type === 'awaitingResultAck') {
      return;
    }

    if (
      finished ||
      reason === 'success' ||
      reason === 'local_closed' ||
      !authority.isActive()
    ) {
      return;
    }

    if (failureReason) {
      setTerminal({ type: 'failed', reason: failureReason });
      return;
    }

    if (state.type === 'awaitingResultAck') {
      setTerminal({
        type: 'result_delivery_failed',
        ...state.result,
        reason: 'Connection closed before login acknowledgement.',
      });
      return;
    }

    setTerminal({
      type: 'failed',
      reason:
        state.type === 'awaitingProof'
          ? 'Connection closed by the remote peer.'
          : 'Connection closed before login verification completed.',
    });
  };

  session = new ProtocolSession({
    sessionId,
    network,
    transport,
    codec: {
      createMessage: createProtocolMessage,
      parseMessage: parseProtocolMessage,
    },
    onMessage: handleMessage,
    onError: (error) => {
      if (finished || !authority.isActive()) return;
      const payload =
        error instanceof ProtocolMessageError
          ? error.payload
          : createProtocolErrorPayload(
              'internal_error',
              'Invalid login protocol message',
            );

      if (state.type === 'awaitingResultAck') {
        settleFailedOrResultDeliveryFailed(formatProtocolError(payload));
        try {
          session.close('protocol_error');
        } catch {}
        return;
      }

      void fail(payload);
    },
    onClose: handleClose,
  });

  const cancel = (reason = 'Login canceled') => {
    if (finished) return;

    if (state.type === 'awaitingResultAck') {
      setTerminal({
        type: 'result_delivery_failed',
        ...state.result,
        reason,
      });
      try {
        session.close('local_closed');
      } catch {}
      return;
    }

    void fail(
      createProtocolErrorPayload('transaction_rejected', reason, {
        phase: 'login',
      }),
    );
  };

  return {
    session,
    cancel,
    dispose: () => {
      clearCloseFallbackTimeout();
      if (!finished) cancel('Login session disposed');
      session.dispose();
    },
    getState: () => state,
  };
};

export const startLoginHostSessionForConnection = (
  params: Omit<StartLoginHostSessionParams, 'transport'> & {
    connection: Parameters<typeof createPeerDataConnectionTransport>[0];
  },
) =>
  startLoginHostSession({
    ...params,
    transport: createPeerDataConnectionTransport(params.connection),
  });
