import { fromBase64 } from '@mysten/sui/utils';
import type { NETWORK } from './walletTypes';

export interface IAccount {
  network: NETWORK;
  address: string;
  publicKey: string;
}

const KEY_ACCOUNT = 'walrus:account';
const LEGACY_KEY_NONCE = 'walrus:nonce';

const hasStorage =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getItem = (key: string): string | undefined =>
  hasStorage ? (localStorage.getItem(key) ?? undefined) : undefined;

const setItem = (key: string, value: string) => {
  if (hasStorage) localStorage.setItem(key, value);
};

const removeItem = (key: string) => {
  if (hasStorage) localStorage.removeItem(key);
};

function safeParse<T>(raw: string | undefined): T | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed === undefined ? undefined : (parsed as T);
  } catch {
    return undefined;
  }
}

const isValidStoredPublicKey = (value: unknown): value is string => {
  if (typeof value !== 'string' || value.length === 0) return false;

  try {
    return fromBase64(value).length > 0;
  } catch {
    return false;
  }
};

const isStoredAccount = (value: unknown): value is IAccount =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IAccount).address === 'string' &&
  typeof (value as IAccount).network === 'string' &&
  isValidStoredPublicKey((value as IAccount).publicKey);

export const getAccountData = (): IAccount | undefined => {
  const parsed = safeParse<unknown>(getItem(KEY_ACCOUNT));
  if (!isStoredAccount(parsed)) {
    // Legacy account entries (pre-removal: zkLogin payloads, or shapes without
    // a stored publicKey) are no longer valid. Drop them so the next connect
    // goes through QR login and stores a fresh publicKey from the proof.
    if (parsed) removeItem(KEY_ACCOUNT);
    return undefined;
  }
  return {
    network: parsed.network,
    address: parsed.address,
    publicKey: parsed.publicKey,
  };
};

export const setAccountData = (v: IAccount): void => {
  removeItem(LEGACY_KEY_NONCE);
  setItem(
    KEY_ACCOUNT,
    JSON.stringify({
      network: v.network,
      address: v.address,
      publicKey: v.publicKey,
    }),
  );
};

export const disconnect = (): void => {
  removeItem(LEGACY_KEY_NONCE);
  removeItem(KEY_ACCOUNT);
};
