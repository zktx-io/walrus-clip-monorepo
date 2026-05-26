import { createPeerDataConnectionTransport } from './peerTransport';
import { startSignScannerRunner } from './signScannerRunner';
import type { ClipSigner, NETWORK, NotiVariant } from '../types';
import {
  connectWithRelayFallback,
  type RelayConnectionHandle,
} from '../webrtc/connection';
import { parsePeerId } from '../webrtc/qr-id';

export const connectQRSign = ({
  signer,
  network,
  destId,
  onEvent,
  iceConfigUrl,
  onConnected,
  onConnectionFailure,
}: {
  signer: ClipSigner;
  network: NETWORK;
  destId: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  iceConfigUrl?: string;
  onConnected?: () => void;
  onConnectionFailure?: (message: string) => void;
}): RelayConnectionHandle | undefined => {
  const OPEN_TIMEOUT_MS = 8000;
  const parsedDest = parsePeerId(destId);
  if (!parsedDest || parsedDest.type !== 'sign') {
    onEvent({ variant: 'error', message: 'Invalid sign QR peer id' });
    return undefined;
  }
  if (parsedDest.network !== network) {
    onEvent({ variant: 'error', message: 'Invalid network' });
    return undefined;
  }

  const { sessionId } = parsedDest;
  const destHyphen = destId.replace(/::/g, '-');
  let runner: ReturnType<typeof startSignScannerRunner> | undefined;

  onEvent({ variant: 'info', message: 'Connecting...' });

  const connection = connectWithRelayFallback({
    destIdHyphen: destHyphen,
    iceConfigUrl,
    openTimeoutMs: OPEN_TIMEOUT_MS,
    onEvent,
    onFailure: onConnectionFailure,
    onOpen: (conn) => {
      runner = startSignScannerRunner({
        signer,
        network,
        sessionId,
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
