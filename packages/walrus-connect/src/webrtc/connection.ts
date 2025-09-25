import Peer, { DataConnection } from 'peerjs';

import { generateRandomId } from './generateRandomId';
import { NotiVariant } from '../types';

export type IceConf = {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy; // 'all' | 'relay'
};

export const DEFAULT_ICE_CONF: IceConf = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
    { urls: 'stun:stun.stunprotocol.org' },
  ],
  iceTransportPolicy: 'all',
};

/** Fetch {url}/ice-conf.json and return parsed ICE config. */
export async function loadIceConfig(
  url: string,
  timeoutMs = 5000,
): Promise<IceConf | undefined> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(`${url.replace(/\/+$/, '')}/ice-conf.json`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: ctl.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(t);
    if (!res.ok) return undefined;

    const json = await res.json();
    const conf: IceConf = {};
    if (Array.isArray(json.iceServers)) conf.iceServers = json.iceServers;
    if (
      json.iceTransportPolicy === 'relay' ||
      json.iceTransportPolicy === 'all'
    ) {
      conf.iceTransportPolicy = json.iceTransportPolicy;
    }
    return conf;
  } catch {
    return undefined;
  }
}

export function toPeerOptions(conf: IceConf) {
  return { config: conf } as const;
}

/** base64url encode/decode helpers for QR suffix. */
export function b64urlEncode(str: string) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function b64urlDecode(b64url: string) {
  const pad =
    b64url.length % 4 === 2 ? '==' : b64url.length % 4 === 3 ? '=' : '';
  return atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

export async function createPeerWithIce(opts: {
  id: string;
  iceConfigUrl?: string;
  relayOnly?: boolean;
}) {
  const base = opts.iceConfigUrl
    ? ((await loadIceConfig(opts.iceConfigUrl)) ?? DEFAULT_ICE_CONF)
    : DEFAULT_ICE_CONF;

  const conf = opts.relayOnly
    ? { ...base, iceTransportPolicy: 'relay' as const }
    : base;
  return new Peer(opts.id, toPeerOptions(conf) as any);
}

export function withOpenTimeout<T extends { open: boolean; close: () => void }>(
  conn: T,
  ms: number,
  onTimeout: () => void,
) {
  const timer = setTimeout(() => {
    if (!conn.open) onTimeout();
  }, ms);
  return () => clearTimeout(timer);
}

export async function connectWithRelayFallback(opts: {
  destIdHyphen: string;
  iceConfigUrl?: string;
  openTimeoutMs: number;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onOpen: (conn: DataConnection) => void;
}) {
  const { destIdHyphen, iceConfigUrl, openTimeoutMs, onEvent, onOpen } = opts;

  // 1st attempt: direct P2P
  const p1 = await createPeerWithIce({ id: generateRandomId(), iceConfigUrl });
  const c1 = p1.connect(destIdHyphen);
  const clear1 = withOpenTimeout(c1, openTimeoutMs, async () => {
    if (!c1.open) {
      try {
        c1.close();
      } catch {}
      onEvent({
        variant: 'warning',
        message: 'Direct P2P failed. Retrying via TURN relay…',
      });

      // 2nd attempt: relay-only
      const p2 = await createPeerWithIce({
        id: generateRandomId(),
        iceConfigUrl,
        relayOnly: true,
      });
      const c2 = p2.connect(destIdHyphen);
      const clear2 = withOpenTimeout(c2, openTimeoutMs, () => {
        try {
          c2.close();
        } catch {}
        onEvent({ variant: 'error', message: 'Relay connection timed out.' });
      });

      c2.on('open', () => {
        clear2();
        onOpen(c2);
      });
      p2.on('error', (err) =>
        onEvent({ variant: 'error', message: `Peer error: ${err.message}` }),
      );
    }
  });

  c1.on('open', () => {
    clear1();
    onOpen(c1);
  });

  p1.on('error', (err) =>
    onEvent({ variant: 'error', message: `Peer error: ${err.message}` }),
  );

  return () => {
    try {
      p1.destroy();
    } catch {}
  };
}
