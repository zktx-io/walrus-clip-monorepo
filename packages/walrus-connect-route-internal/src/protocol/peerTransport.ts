import type { DataConnection } from 'peerjs';

import type { ProtocolTransport } from './session';

type PeerEventHandler = (...args: unknown[]) => void;

const removePeerListener = (
  connection: DataConnection,
  event: 'data' | 'close' | 'error',
  handler: PeerEventHandler,
) => {
  const emitter = connection as DataConnection & {
    off?: (event: string, handler: PeerEventHandler) => void;
    removeListener?: (event: string, handler: PeerEventHandler) => void;
  };

  if (typeof emitter.off === 'function') {
    emitter.off(event, handler);
    return;
  }
  if (typeof emitter.removeListener === 'function') {
    emitter.removeListener(event, handler);
  }
};

export const createPeerDataConnectionTransport = (
  connection: DataConnection,
): ProtocolTransport => ({
  send: (raw) => {
    connection.send(raw);
  },
  close: () => {
    connection.close();
  },
  isOpen: () => connection.open,
  onMessage: (handler) => {
    connection.on('data', handler);
    return () => removePeerListener(connection, 'data', handler);
  },
  onClose: (handler) => {
    connection.on('close', handler);
    return () => removePeerListener(connection, 'close', handler);
  },
  onError: (handler) => {
    connection.on('error', handler);
    return () =>
      removePeerListener(connection, 'error', handler as PeerEventHandler);
  },
});
