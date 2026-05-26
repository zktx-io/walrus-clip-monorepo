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
  WalrusWalletTransactionExecutionError,
  WalrusWalletTransactionUncertainError,
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

test('wallet QR route errors preserve digest recovery fields', () => {
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

test('wallet transaction execution errors preserve the submitted digest from a Core API FailedTransaction so dApps can recover', () => {
  const error = new WalrusWalletTransactionExecutionError({
    reason: 'Transaction digest-failed executed but reported failure: Move abort 5',
    digest: 'digest-failed',
    bytes: 'tx-bytes',
    signature: 'signature',
  });

  assert.equal(error.code, 'WALRUS_TRANSACTION_EXECUTION_FAILED');
  assert.equal(error.digest, 'digest-failed');
  assert.equal(error.bytes, 'tx-bytes');
  assert.equal(error.signature, 'signature');
  assert.equal(error.details.digest, 'digest-failed');
});

test('wallet transaction execution errors expose grpc transport identity for Sui execute failures', () => {
  const error = new WalrusWalletTransactionExecutionError({
    reason: 'Transaction digest-failed executed but reported failure: Move abort 5',
    digest: 'digest-failed',
    bytes: 'tx-bytes',
    signature: 'signature',
    suiTransport: 'grpc',
  });

  assert.equal(error.details.suiTransport, 'grpc');
  assert.equal(error.message.includes('grpc'), false);
});

test('wallet transaction execution errors stay usable with the legacy string-only constructor for pre-submit failures with no digest', () => {
  const error = new WalrusWalletTransactionExecutionError(
    'Failed to execute transaction: network down',
  );

  assert.equal(error.code, 'WALRUS_TRANSACTION_EXECUTION_FAILED');
  assert.equal(error.message, 'Failed to execute transaction: network down');
  assert.equal(error.digest, undefined);
  assert.equal(error.bytes, undefined);
  assert.equal(error.signature, undefined);
});

test('wallet transaction uncertainty errors expose grpc transport identity for Sui confirmation failures', () => {
  const error = new WalrusWalletTransactionUncertainError({
    phase: 'confirmation',
    digest: 'digest-submitted',
    bytes: 'tx-bytes',
    signature: 'signature',
    reason: 'finality timeout',
    suiTransport: 'grpc',
  });

  assert.equal(error.code, 'WALRUS_TRANSACTION_UNCERTAIN');
  assert.equal(error.details.phase, 'confirmation');
  assert.equal(error.details.digest, 'digest-submitted');
  assert.equal(error.details.suiTransport, 'grpc');
  assert.equal(error.message.includes('grpc'), false);
});

test('wallet transaction uncertainty errors do not attach Sui transport identity for sponsored endpoint failures', () => {
  const error = new WalrusWalletTransactionUncertainError({
    phase: 'sponsored-execution',
    digest: 'digest-sponsored',
    bytes: 'tx-bytes',
    signature: 'signature',
    reason: 'sponsor unavailable',
  });

  assert.equal(error.code, 'WALRUS_TRANSACTION_UNCERTAIN');
  assert.equal(error.details.phase, 'sponsored-execution');
  assert.equal(error.details.digest, 'digest-sponsored');
  assert.equal(error.details.suiTransport, undefined);
});
