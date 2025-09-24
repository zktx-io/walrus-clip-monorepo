// src/config.ts
export const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.stunprotocol.org' },
      {
        urls: 'turn:numb.viagenie.ca',
        username: 'webrtc@live.com',
        credential: 'muazkh',
      },
    ],
  },
} as const;

export const PEER_CONFIG_RELAY = {
  config: {
    ...PEER_CONFIG.config,
    iceTransportPolicy: 'relay',
  },
} as const;
