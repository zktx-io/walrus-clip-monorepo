import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

class MemoryStorage {
  #store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#store.has(key) ? (this.#store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, value);
  }

  removeItem(key: string): void {
    this.#store.delete(key);
  }

  get size(): number {
    return this.#store.size;
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.#store);
  }
}

const memoryStorage = new MemoryStorage();
(globalThis as { window?: { localStorage: MemoryStorage } }).window = {
  localStorage: memoryStorage,
};
(globalThis as { localStorage?: MemoryStorage }).localStorage = memoryStorage;

const jiti = createJiti(import.meta.url);
const { getAccountData, setAccountData, disconnect } = await jiti.import<
  typeof import('../src/utils/localStorage.ts')
>('../src/utils/localStorage.ts');

const VALID_PUBLIC_KEY = 'AAECAw==';

const resetStorage = () => {
  memoryStorage.removeItem('walrus:account');
  memoryStorage.removeItem('walrus:nonce');
};

test('setAccountData persists the network, address, and publicKey only', () => {
  resetStorage();
  setAccountData({
    network: 'testnet',
    address: '0xabc',
    publicKey: VALID_PUBLIC_KEY,
  });

  const stored = JSON.parse(memoryStorage.getItem('walrus:account') ?? 'null');
  assert.deepEqual(stored, {
    network: 'testnet',
    address: '0xabc',
    publicKey: VALID_PUBLIC_KEY,
  });
});

test('setAccountData clears any legacy zkLogin nonce entry alongside the account write', () => {
  resetStorage();
  memoryStorage.setItem('walrus:nonce', JSON.stringify({ legacy: true }));

  setAccountData({
    network: 'testnet',
    address: '0xabc',
    publicKey: VALID_PUBLIC_KEY,
  });

  assert.equal(memoryStorage.getItem('walrus:nonce'), null);
});

test('getAccountData round-trips the publicKey so the wallet account can carry real bytes', () => {
  resetStorage();
  setAccountData({
    network: 'testnet',
    address: '0xabc',
    publicKey: VALID_PUBLIC_KEY,
  });

  assert.deepEqual(getAccountData(), {
    network: 'testnet',
    address: '0xabc',
    publicKey: VALID_PUBLIC_KEY,
  });
});

test('getAccountData drops legacy entries that do not carry a publicKey so the next connect goes through QR login', () => {
  resetStorage();
  memoryStorage.setItem(
    'walrus:account',
    JSON.stringify({
      network: 'testnet',
      address: '0xabc',
      // Legacy zkLogin payload had no top-level publicKey.
      zkLogin: { proofInfo: { addressSeed: '1' } },
    }),
  );

  assert.equal(getAccountData(), undefined);
  assert.equal(memoryStorage.getItem('walrus:account'), null);
});

test('getAccountData drops corrupt entries with invalid base64 publicKey before wallet account reuse', () => {
  resetStorage();
  memoryStorage.setItem(
    'walrus:account',
    JSON.stringify({
      network: 'testnet',
      address: '0xabc',
      publicKey: 'not-base64',
    }),
  );

  assert.equal(getAccountData(), undefined);
  assert.equal(memoryStorage.getItem('walrus:account'), null);
});

test('disconnect clears both the account and any legacy nonce entry', () => {
  resetStorage();
  setAccountData({
    network: 'testnet',
    address: '0xabc',
    publicKey: VALID_PUBLIC_KEY,
  });
  memoryStorage.setItem('walrus:nonce', JSON.stringify({ legacy: true }));

  disconnect();

  assert.equal(memoryStorage.getItem('walrus:account'), null);
  assert.equal(memoryStorage.getItem('walrus:nonce'), null);
});
