// src/config.ts
export const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.stunprotocol.org' },
    ],
    iceTransportPolicy: 'all',
  },
} as const;

export const PEER_CONFIG_RELAY = {
  config: {
    ...PEER_CONFIG.config,
    iceTransportPolicy: 'relay',
  },
} as const;
