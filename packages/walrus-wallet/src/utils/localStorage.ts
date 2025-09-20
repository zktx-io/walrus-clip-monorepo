import { IAccount, IZkLogin } from './types';

const KEY_NONCE = 'walrus:nonce';
const KEY_ACCOUNT = 'walrus:account';

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

export const getZkLoginData = ():
  | { network: IAccount['network']; zkLogin: IZkLogin }
  | undefined => safeParse(getItem(KEY_NONCE));

export const setZkLoginData = (v: {
  network: IAccount['network'];
  zkLogin: IZkLogin;
}): void => {
  setItem(KEY_NONCE, JSON.stringify(v));
};

export const getAccountData = (): IAccount | undefined =>
  safeParse<IAccount>(getItem(KEY_ACCOUNT));

export const setAccountData = (v: IAccount): void => {
  removeItem(KEY_NONCE);
  setItem(KEY_ACCOUNT, JSON.stringify(v));
};

export const disconnect = (): void => {
  removeItem(KEY_NONCE);
  removeItem(KEY_ACCOUNT);
};
