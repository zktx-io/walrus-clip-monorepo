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

export type RelayConnectionHandle = {
  cleanup: () => void;
  done: Promise<void>;
};

type RelayPeer = {
  connect: (destId: string) => DataConnection;
  destroy: () => void;
  on: (event: 'error', handler: (error: Error) => void) => void;
};

export function connectWithRelayFallback(opts: {
  destIdHyphen: string;
  iceConfigUrl?: string;
  openTimeoutMs: number;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onOpen: (conn: DataConnection) => void;
  onFailure?: (message: string) => void;
  deps?: {
    createPeerWithIce?: typeof createPeerWithIce;
  };
}): RelayConnectionHandle {
  const createPeer = opts.deps?.createPeerWithIce ?? createPeerWithIce;
  let p1: RelayPeer | undefined;
  let p2: RelayPeer | undefined;
  let c1: DataConnection | undefined;
  let c2: DataConnection | undefined;
  let clear1: (() => void) | undefined;
  let clear2: (() => void) | undefined;
  let isConnected = false;
  let relayAttempted = false;
  let cleanedUp = false;
  let failureReported = false;

  const reportFailure = (message: string) => {
    if (failureReported || isConnected) return;
    failureReported = true;
    opts.onFailure?.(message);
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (clear1) clear1();
    if (clear2) clear2();
    try {
      if (c1) c1.close();
    } catch {}
    try {
      if (c2) c2.close();
    } catch {}
    try {
      if (p1) p1.destroy();
    } catch {}
    try {
      if (p2) p2.destroy();
    } catch {}
  };

  const attachAutoCleanup = (conn: DataConnection) => {
    conn.on('close', cleanup);
    conn.on('error', cleanup);
  };

  const startRelayAttempt = async (reason: 'timeout' | 'error') => {
    if (relayAttempted || isConnected) return;
    relayAttempted = true;

    try {
      if (c1) c1.close();
    } catch {}
    try {
      p1?.destroy();
    } catch {}

    opts.onEvent({
      variant: 'warning',
      message:
        reason === 'timeout'
          ? 'Direct P2P failed. Retrying via TURN relay…'
          : 'Direct P2P error. Retrying via TURN relay…',
    });

    try {
      const relayPeer = await createPeer({
        id: generateRandomId(),
        iceConfigUrl: opts.iceConfigUrl,
        relayOnly: true,
      });
      if (cleanedUp) {
        try {
          relayPeer.destroy();
        } catch {}
        return;
      }
      p2 = relayPeer;
      c2 = p2.connect(opts.destIdHyphen);

      clear2 = withOpenTimeout(c2, opts.openTimeoutMs, () => {
        if (isConnected) return;
        const message = 'Relay connection timed out.';
        opts.onEvent({
          variant: 'error',
          message,
        });
        reportFailure(message);
        cleanup();
      });

      c2.on('open', () => {
        if (isConnected || !c2 || cleanedUp) return;
        isConnected = true;
        if (clear2) clear2();
        attachAutoCleanup(c2);
        opts.onOpen(c2);
      });

      c2.on('error', (err) => {
        if (cleanedUp) return;
        const message = `Connection error: ${err.message}`;
        opts.onEvent({
          variant: 'error',
          message,
        });
        reportFailure(message);
        cleanup();
      });

      p2.on('error', (err) => {
        if (cleanedUp) return;
        const message = `Peer error: ${err.message}`;
        opts.onEvent({
          variant: 'error',
          message,
        });
        reportFailure(message);
        cleanup();
      });
    } catch (error) {
      if (!cleanedUp) {
        const message = `Relay init error: ${String(error)}`;
        opts.onEvent({
          variant: 'error',
          message,
        });
        reportFailure(message);
        cleanup();
      }
    }
  };

  const done = (async () => {
    try {
      // 1st attempt: direct P2P
      const directPeer = await createPeer({
        id: generateRandomId(),
        iceConfigUrl: opts.iceConfigUrl,
      });
      if (cleanedUp) {
        try {
          directPeer.destroy();
        } catch {}
        return;
      }
      p1 = directPeer;
      c1 = p1.connect(opts.destIdHyphen);

      clear1 = withOpenTimeout(c1, opts.openTimeoutMs, () =>
        startRelayAttempt('timeout'),
      );

      c1.on('open', () => {
        if (isConnected || !c1 || cleanedUp) return;
        if (relayAttempted) {
          try {
            c1.close();
          } catch {}
          return;
        }
        isConnected = true;
        if (clear1) clear1();
        attachAutoCleanup(c1);
        opts.onOpen(c1);
      });

      c1.on('error', () => startRelayAttempt('error'));

      p1.on('error', (err) => {
        if (cleanedUp) return;
        opts.onEvent({
          variant: 'error',
          message: `Peer error: ${err.message}`,
        });
        startRelayAttempt('error');
      });
    } catch (error) {
      cleanup();
      throw error;
    }
  })();

  return { cleanup, done };
}
