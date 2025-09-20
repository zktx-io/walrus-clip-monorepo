import { fromHex, toHex } from '@mysten/sui/utils';

const PBKDF2_ITERATIONS = 250_000;
const enc = new TextEncoder();

const deriveKey = async (password: string, saltHex: string) => {
  const salt = fromHex(saltHex);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
};

export const encryptText = async (
  text: string,
  password: string,
): Promise<{ encrypted: string; iv: string; salt: string }> => {
  const data = new TextEncoder().encode(text);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, toHex(salt));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data,
  );
  return {
    encrypted: toHex(new Uint8Array(encrypted)),
    iv: toHex(iv),
    salt: toHex(salt),
  };
};

export const decryptText = async (
  password: string,
  encrypted: string,
  iv: string,
  salt: string,
): Promise<string> => {
  try {
    const key = await deriveKey(password, salt);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromHex(iv) },
      key,
      fromHex(encrypted),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
};

export const shortenAddress = (addr: string) => {
  if (!addr) return '';
  if (addr.length <= 25) return addr;
  return addr.slice(0, 12) + '...' + addr.slice(-10);
};

export const isSuiAddress = (a: string) => /^0x[0-9a-fA-F]{1,64}$/.test(a);
