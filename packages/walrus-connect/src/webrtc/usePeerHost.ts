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
    (async () => {
      const p = await createPeerWithIce({ id: peerIdHyphen, iceConfigUrl });
      peer = p;
      p.on('connection', onConnection);
      p.on('error', (err) =>
        onEvent({ variant: 'error', message: `Peer error: ${err.message}` }),
      );
    })();

    return () => {
      try {
        peer?.destroy();
      } catch {}
    };
  }, [peerIdHyphen, iceConfigUrl, onEvent, onConnection]);
}
