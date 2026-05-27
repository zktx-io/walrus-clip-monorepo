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
    // Test-only public relay fallback. Production apps should pass
    // app-owned short-lived TURN credentials through iceConfigUrl.
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceTransportPolicy: 'all',
};

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function hasTurnServer(conf: IceConf): boolean {
  return (
    conf.iceServers?.some((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      return urls.some(
        (url) => typeof url === 'string' && /^turns?:/i.test(url.trim()),
      );
    }) ?? false
  );
}

/** Fetch {url}/ice-conf.json and return parsed ICE config. */
export async function loadIceConfig(
  url: string,
  timeoutMs = 5000,
): Promise<IceConf | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const ctl = new AbortController();
    timeout = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(`${url.replace(/\/+$/, '')}/ice-conf.json`, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: ctl.signal,
      headers: { Accept: 'application/json' },
    });
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
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function toPeerOptions(conf: IceConf) {
  return { config: conf } as const;
}

async function resolveIceConfig({
  iceConfigUrl,
  loadConfig,
}: {
  iceConfigUrl?: string;
  loadConfig: typeof loadIceConfig;
}): Promise<IceConf> {
  if (!iceConfigUrl) return DEFAULT_ICE_CONF;

  const loaded = await loadConfig(iceConfigUrl);
  return loaded ?? DEFAULT_ICE_CONF;
}

export async function createPeerWithIce(opts: {
  id: string;
  iceConfigUrl?: string;
  iceConfig?: IceConf;
  relayOnly?: boolean;
}) {
  const base =
    opts.iceConfig ??
    (await resolveIceConfig({
      iceConfigUrl: opts.iceConfigUrl,
      loadConfig: loadIceConfig,
    }));

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
  on: {
    (event: 'open', handler: (id: string) => void): void;
    (event: 'error', handler: (error: Error) => void): void;
  };
};

function waitForPeerOpen({
  peer,
  timeoutMs,
  label,
}: {
  peer: RelayPeer;
  timeoutMs: number;
  label: 'direct' | 'relay';
}): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`${label} PeerJS open timed out.`));
    }, timeoutMs);

    peer.on('open', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    });

    peer.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

export function connectWithRelayFallback(opts: {
  destIdHyphen: string;
  iceConfigUrl?: string;
  openTimeoutMs: number;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onOpen: (conn: DataConnection) => void;
  onFailure?: (message: string) => void;
  deps?: {
    createPeerWithIce?: typeof createPeerWithIce;
    loadIceConfig?: typeof loadIceConfig;
  };
}): RelayConnectionHandle {
  const createPeer = opts.deps?.createPeerWithIce ?? createPeerWithIce;
  const loadConfig = opts.deps?.loadIceConfig ?? loadIceConfig;
  let baseIceConfigPromise: Promise<IceConf> | undefined;
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

  const getBaseIceConfig = () => {
    baseIceConfigPromise ??= resolveIceConfig({
      iceConfigUrl: opts.iceConfigUrl,
      loadConfig,
    });
    return baseIceConfigPromise;
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

    try {
      const baseIceConfig = await getBaseIceConfig();
      if (!hasTurnServer(baseIceConfig)) {
        const message =
          reason === 'timeout'
            ? 'Direct P2P failed and no TURN relay is configured.'
            : 'Direct P2P error and no TURN relay is configured.';
        opts.onEvent({
          variant: 'error',
          message,
        });
        reportFailure(message);
        cleanup();
        return;
      }

      opts.onEvent({
        variant: 'warning',
        message:
          reason === 'timeout'
            ? 'Direct P2P failed. Retrying via TURN relay…'
            : 'Direct P2P error. Retrying via TURN relay…',
      });

      const relayPeer = await createPeer({
        id: generateRandomId(),
        iceConfigUrl: opts.iceConfigUrl,
        iceConfig: baseIceConfig,
        relayOnly: true,
      });
      if (cleanedUp) {
        try {
          relayPeer.destroy();
        } catch {}
        return;
      }
      p2 = relayPeer;
      await waitForPeerOpen({
        peer: relayPeer,
        timeoutMs: opts.openTimeoutMs,
        label: 'relay',
      });
      if (cleanedUp) return;
      c2 = relayPeer.connect(opts.destIdHyphen);

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

      relayPeer.on('error', (err) => {
        if (cleanedUp) return;
        const message = `Peer error: ${safeErrorMessage(err)}`;
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
        iceConfig: await getBaseIceConfig(),
      });
      if (cleanedUp) {
        try {
          directPeer.destroy();
        } catch {}
        return;
      }
      p1 = directPeer;
      try {
        await waitForPeerOpen({
          peer: directPeer,
          timeoutMs: opts.openTimeoutMs,
          label: 'direct',
        });
      } catch {
        if (cleanedUp) return;
        await startRelayAttempt('error');
        return;
      }
      if (cleanedUp) return;
      c1 = directPeer.connect(opts.destIdHyphen);

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

      c1.on('error', () => {
        startRelayAttempt('error');
      });

      directPeer.on('error', (err) => {
        if (cleanedUp) return;
        opts.onEvent({
          variant: 'error',
          message: `Peer error: ${safeErrorMessage(err)}`,
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
