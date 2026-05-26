import { EffectAuthority, EffectAuthorityTerminatedError } from './effectAuthority';
import { createPeerDataConnectionTransport } from './peerTransport';
import {
  ProtocolSession,
  type ProtocolSessionTerminalReason,
  type ProtocolTransport,
} from './session';
import type { ClipSigner, NETWORK, NotiVariant } from '../types';
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
import {
  connectWithRelayFallback,
  type RelayConnectionHandle,
} from '../webrtc/connection';
import { parsePeerId } from '../webrtc/qr-id';

type LoginScannerState =
  | { type: 'sendingProof' }
  | { type: 'awaitingResult' }
  | { type: 'terminal' };

export type StartLoginScannerSessionParams = {
  signer: ClipSigner;
  sessionId: string;
  network: NETWORK;
  challenge: string;
  transport: ProtocolTransport;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  ackTimeoutMs?: number;
  closeFallbackMs?: number;
  resultTimeoutMs?: number;
};

const LOGIN_RESULT_TIMEOUT_MS = 30000;

export const startLoginScannerSession = ({
  signer,
  sessionId,
  network,
  challenge,
  transport,
  onEvent,
  ackTimeoutMs = ACK_TIMEOUT_MS,
  closeFallbackMs = CLOSE_FALLBACK_TIMEOUT_MS,
  resultTimeoutMs = LOGIN_RESULT_TIMEOUT_MS,
}: StartLoginScannerSessionParams): {
  session: ProtocolSession;
  dispose: () => void;
  getState: () => LoginScannerState;
} => {
  const authority = new EffectAuthority();
  let state: LoginScannerState = { type: 'sendingProof' };
  let suppressCloseWarning = false;
  let localProtocolErrorRequested = false;
  let clearResultTimeout: (() => void) | undefined;
  let closeFallbackTimeout: ReturnType<typeof setTimeout> | undefined;
  let session: ProtocolSession;

  const clearCloseFallbackTimeout = () => {
    if (closeFallbackTimeout) clearTimeout(closeFallbackTimeout);
    closeFallbackTimeout = undefined;
  };

  const markTerminal = () => {
    if (state.type === 'terminal') return;
    clearResultTimeout?.();
    clearCloseFallbackTimeout();
    state = { type: 'terminal' };
    authority.terminate('completed');
  };

  const closeAfterFallback = (
    reason: ProtocolSessionTerminalReason = 'protocol_error',
  ) => {
    clearCloseFallbackTimeout();
    closeFallbackTimeout = setTimeout(() => {
      markTerminal();
      session?.close(reason);
    }, closeFallbackMs);
  };

  const sendProtocolErrorAndClose = (payload: ProtocolErrorPayload) => {
    if (localProtocolErrorRequested || state.type === 'terminal') return;
    localProtocolErrorRequested = true;
    suppressCloseWarning = true;
    clearResultTimeout?.();
    onEvent({
      variant: 'error',
      message: formatProtocolError(payload),
    });

    if (!session.isActive() || !authority.isActive()) {
      session.close('protocol_error');
      markTerminal();
      return;
    }

    void (async () => {
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
      session.close('protocol_error');
      markTerminal();
    })();
  };

  const startResultTimeout = () => {
    clearResultTimeout?.();
    clearResultTimeout = authority.setTimeout(() => {
      if (state.type !== 'awaitingResult') return;
      sendProtocolErrorAndClose(
        createProtocolErrorPayload(
          'session_timeout',
          'Timed out waiting for login result',
          { phase: 'login_result' },
        ),
      );
    }, resultTimeoutMs);
  };

  const sendProof = async () => {
    try {
      const encoder = new TextEncoder();
      const { signature } = await authority.cancellable(() =>
        signer.signPersonalMessage(encoder.encode(challenge)),
      );
      const publicKey = signer.getPublicKey().toSuiPublicKey();
      state = { type: 'awaitingResult' };
      startResultTimeout();
      authority.send(session, 'login.proof', {
        address: signer.getAddress(),
        publicKey,
        signature,
        challenge,
      });
    } catch (error) {
      if (
        !authority.isActive() ||
        error instanceof EffectAuthorityTerminatedError ||
        state.type === 'terminal'
      ) {
        return;
      }
      suppressCloseWarning = true;
      onEvent({ variant: 'error', message: String(error) });
      session.close('protocol_error');
      markTerminal();
    }
  };

  session = new ProtocolSession({
    sessionId,
    network,
    transport,
    codec: {
      createMessage: createProtocolMessage,
      parseMessage: parseProtocolMessage,
    },
    onMessage: (message: ProtocolEnvelope) => {
      try {
        if (state.type === 'terminal' || localProtocolErrorRequested) return;

        if (isProtocolErrorMessage(message)) {
          suppressCloseWarning = true;
          localProtocolErrorRequested = true;
          clearResultTimeout?.();
          authority.trySendTerminalAck(session, message, {
            code: message.payload.code,
            ackSequence: message.sequence,
          });
          onEvent({
            variant: 'error',
            message: formatProtocolError(message.payload),
          });
          markTerminal();
          closeAfterFallback('protocol_error');
          return;
        }

        if (
          state.type !== 'awaitingResult' ||
          message.type !== 'login.result'
        ) {
          throw new ProtocolMessageError(
            createProtocolErrorPayload(
              'type_mismatch',
              'Unexpected login protocol message',
            ),
          );
        }

        clearResultTimeout?.();
        session.sendAck(message, 'login.result.ack', {
          accepted: true,
          ackSequence: message.sequence,
        });
        suppressCloseWarning = true;
        onEvent({ variant: 'success', message: 'Connected' });
        markTerminal();
        session.markTerminal('success');
        closeAfterFallback('success');
      } catch (error) {
        sendProtocolErrorAndClose(
          error instanceof ProtocolMessageError
            ? error.payload
            : createProtocolErrorPayload(
                'internal_error',
                'Failed to handle login protocol message',
              ),
        );
      }
    },
    onError: (error) => {
      if (state.type === 'terminal' || localProtocolErrorRequested) return;
      sendProtocolErrorAndClose(
        error instanceof ProtocolMessageError
          ? error.payload
          : createProtocolErrorPayload(
              'internal_error',
              'Invalid login protocol message',
            ),
      );
    },
    onClose: (reason: ProtocolSessionTerminalReason) => {
      clearResultTimeout?.();
      const closeState = state;
      markTerminal();
      if (
        suppressCloseWarning ||
        reason === 'success' ||
        reason === 'local_closed'
      ) {
        return;
      }
      onEvent({
        variant: 'error',
        message:
          closeState.type === 'awaitingResult'
            ? 'Connection closed before login result.'
            : 'Connection closed before login proof was sent.',
      });
    },
  });

  void sendProof();

  return {
    session,
    dispose: () => {
      suppressCloseWarning = true;
      clearCloseFallbackTimeout();
      authority.cancel('cancelled');
      session.dispose();
    },
    getState: () => state,
  };
};

export const connectQRLogin = ({
  signer,
  destId,
  onEvent,
  iceConfigUrl,
  onConnected,
  onConnectionFailure,
}: {
  signer: ClipSigner;
  destId: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  iceConfigUrl?: string;
  onConnected?: () => void;
  onConnectionFailure?: (message: string) => void;
}): RelayConnectionHandle | undefined => {
  const OPEN_TIMEOUT_MS = 8000;
  const parsedDest = parsePeerId(destId);
  if (!parsedDest || parsedDest.type !== 'login') {
    onEvent({ variant: 'error', message: 'Invalid login QR peer id' });
    return undefined;
  }

  const { sessionId, network } = parsedDest;
  const destHyphen = destId.replace(/::/g, '-');
  let runner: ReturnType<typeof startLoginScannerSession> | undefined;

  onEvent({ variant: 'info', message: 'Connecting...' });

  const connection = connectWithRelayFallback({
    destIdHyphen: destHyphen,
    iceConfigUrl,
    openTimeoutMs: OPEN_TIMEOUT_MS,
    onEvent,
    onFailure: onConnectionFailure,
    onOpen: (conn) => {
      runner = startLoginScannerSession({
        signer,
        sessionId,
        network,
        challenge: destId,
        transport: createPeerDataConnectionTransport(conn),
        onEvent,
      });
      onConnected?.();
    },
  });

  void connection.done.catch((err) => {
    const message = `Connect init error: ${String(err)}`;
    onEvent({
      variant: 'error',
      message,
    });
    onConnectionFailure?.(message);
  });

  return {
    done: connection.done,
    cleanup: () => {
      runner?.dispose();
      connection.cleanup();
    },
  };
};
