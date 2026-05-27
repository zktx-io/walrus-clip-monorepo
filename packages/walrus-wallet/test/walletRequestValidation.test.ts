import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  assertWalletRequestAccount,
  assertWalletRequestChain,
} = await jiti.import<
  typeof import('../src/runtime/walletRequestValidation.ts')
>('../src/runtime/walletRequestValidation.ts');
const {
  WalrusWalletAccountMismatchError,
  WalrusWalletChainMismatchError,
  WalrusWalletLoginRouteError,
  WalrusWalletQrRouteError,
} = await jiti.import<typeof import('../src/runtime/walletErrors.ts')>(
  '../src/runtime/walletErrors.ts',
);

const account = (address: string) => ({
  address,
  publicKey: new Uint8Array([1, 2, 3]),
  chains: ['sui:testnet'],
  features: ['sui:signAndExecuteTransaction'],
});

test('accepts a request for the active Wallet Standard account', () => {
  const activeAccount = account('0xabc');
  assert.doesNotThrow(() =>
    assertWalletRequestAccount({
      activeAccount,
      requestedAccount: activeAccount,
    }),
  );
});

test('rejects a request for a different account', () => {
  assert.throws(
    () =>
      assertWalletRequestAccount({
        activeAccount: account('0xabc'),
        requestedAccount: account('0xdef'),
      }),
    (error) =>
      error instanceof WalrusWalletAccountMismatchError &&
      error.code === 'WALRUS_ACCOUNT_MISMATCH' &&
      error.details.expected === '0xabc' &&
      error.details.received === '0xdef',
  );
});

test('rejects a request when no active account exists', () => {
  assert.throws(
    () =>
      assertWalletRequestAccount({
        activeAccount: undefined,
        requestedAccount: account('0xabc'),
      }),
    WalrusWalletAccountMismatchError,
  );
});

test('validates required request chains', () => {
  assert.doesNotThrow(() =>
    assertWalletRequestChain({
      network: 'testnet',
      chain: 'sui:testnet',
    }),
  );

  assert.throws(
    () =>
      assertWalletRequestChain({
        network: 'mainnet',
        chain: 'sui:testnet',
      }),
    WalrusWalletChainMismatchError,
  );
});

test('allows a missing optional chain and rejects a mismatched optional chain', () => {
  assert.doesNotThrow(() =>
    assertWalletRequestChain({
      network: 'testnet',
      required: false,
    }),
  );

  assert.throws(
    () =>
      assertWalletRequestChain({
        network: 'testnet',
        chain: 'sui:mainnet',
        required: false,
      }),
    WalrusWalletChainMismatchError,
  );
});

test('wallet QR route errors preserve digest recovery fields for post-submit uncertainty', () => {
  const error = new WalrusWalletQrRouteError({
    bytes: 'tx-bytes',
    signature: 'signature',
    digest: 'digest',
    reason: 'finality timeout',
    submitted: true,
    finalityUnknown: true,
  });

  assert.equal(error.code, 'WALRUS_QR_ROUTE_FAILED');
  assert.equal(error.digest, 'digest');
  assert.equal(error.bytes, 'tx-bytes');
  assert.equal(error.signature, 'signature');
  assert.equal(error.submitted, true);
  assert.equal(error.finalityUnknown, true);
  assert.equal(error.details.submitted, true);
  assert.equal(error.details.finalityUnknown, true);
});

test('wallet QR route errors preserve finalized effects when delivery fails after finality', () => {
  const error = new WalrusWalletQrRouteError({
    bytes: 'tx-bytes',
    signature: 'signature',
    digest: 'digest',
    effects: 'effects-base64',
    reason: 'finalized delivery failed',
    submitted: true,
    finalityUnknown: false,
  });

  assert.equal(error.code, 'WALRUS_QR_ROUTE_FAILED');
  assert.equal(error.effects, 'effects-base64');
  assert.equal(error.finalityUnknown, false);
});

test('wallet login route errors expose wallet-owned recovery details', () => {
  const error = new WalrusWalletLoginRouteError({
    address: '0xabc',
    network: 'testnet',
    reason: 'ack timeout',
    accountPersisted: false,
  });

  assert.equal(error.code, 'WALRUS_LOGIN_ROUTE_FAILED');
  assert.equal(error.details.address, '0xabc');
  assert.equal(error.details.network, 'testnet');
  assert.equal(error.accountPersisted, false);
});
