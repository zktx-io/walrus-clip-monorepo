import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export const encryptText = async (
  text: string,
  key: string,
): Promise<{ encrypted: string; iv: string }> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    sha256(key),
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
      sha256(key),
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: hexToBytes(iv) },
      cryptoKey,
      hexToBytes(encrypted),
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    return '';
  }
};
