import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const toArrayBuffer = (u8: Uint8Array): ArrayBuffer => {
  if (u8.buffer instanceof ArrayBuffer) {
    return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
};

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
};

export const encryptText = async (
  text: string,
  key: string,
): Promise<{ encrypted: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(sha256(new TextEncoder().encode(key))),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data,
  );

  return {
    encrypted: bytesToHex(new Uint8Array(encrypted)),
    iv: bytesToHex(iv),
  };
};

export const decryptText = async (
  key: string,
  encrypted: string,
  iv: string,
): Promise<string> => {
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      toArrayBuffer(sha256(new TextEncoder().encode(key))),
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(hexToBytes(iv)) },
      cryptoKey,
      toArrayBuffer(hexToBytes(encrypted)),
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    return '';
  }
};

export const shortenAddress = (addr: string) =>
  addr.slice(0, 12) + '...' + addr.slice(-10);
