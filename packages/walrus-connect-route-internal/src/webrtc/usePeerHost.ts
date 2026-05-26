// src/webrtc/usePeerHost.ts
import { useEffect } from 'react';

import Peer, { DataConnection } from 'peerjs';

import { createPeerWithIce } from './connection';
import { NotiVariant } from '../types';

export function usePeerHost(params: {
  peerIdHyphen: string;
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onConnection: (conn: DataConnection) => void;
}) {
  const { peerIdHyphen, iceConfigUrl, onEvent, onConnection } = params;

  useEffect(() => {
    let peer: Peer | undefined;
    let cancelled = false;
    (async () => {
      try {
        const p = await createPeerWithIce({ id: peerIdHyphen, iceConfigUrl });
        if (cancelled) {
          try {
            p.destroy();
          } catch {}
          return;
        }
        peer = p;
        p.on('connection', onConnection);
        p.on('error', (err) =>
          onEvent({ variant: 'error', message: `Peer error: ${err.message}` }),
        );
      } catch (err) {
        if (!cancelled) {
          onEvent({
            variant: 'error',
            message: `Peer init error: ${String(err)}`,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        peer?.destroy();
      } catch {}
    };
  }, [peerIdHyphen, iceConfigUrl, onEvent, onConnection]);
}
