import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  createWalrusWalletFeatures,
  WALRUS_ACCOUNT_FEATURE_NAMES,
} = await jiti.import<
  typeof import('../src/runtime/walletCapabilities.ts')
>('../src/runtime/walletCapabilities.ts');
test('advertises all QR-backed signing features at wallet and account level', () => {
  const features = createWalrusWalletFeatures({
    connect: async () => ({ accounts: [] }),
    disconnect: async () => {},
    on: () => () => {},
    signAndExecuteTransaction: async () => {
      throw new Error('not called');
    },
    signPersonalMessage: async () => {
      throw new Error('not called');
    },
    signTransaction: async () => {
      throw new Error('not called');
    },
  });

  assert.ok(features['sui:signTransaction']);
  assert.ok(features['sui:signPersonalMessage']);
  assert.ok(features['sui:signAndExecuteTransaction']);
  assert.deepEqual(WALRUS_ACCOUNT_FEATURE_NAMES, [
    'sui:signAndExecuteTransaction',
    'sui:signPersonalMessage',
    'sui:signTransaction',
  ]);
});

test('routes signTransaction through the registered feature method', async () => {
  const features = createWalrusWalletFeatures({
    connect: async () => ({ accounts: [] }),
    disconnect: async () => {},
    on: () => () => {},
    signAndExecuteTransaction: async () => {
      throw new Error('not called');
    },
    signPersonalMessage: async () => {
      throw new Error('not called');
    },
    signTransaction: async () => {
      return { bytes: 'tx-bytes', signature: 'tx-signature' };
    },
  });

  assert.deepEqual(
    await features['sui:signTransaction'].signTransaction({} as never),
    { bytes: 'tx-bytes', signature: 'tx-signature' },
  );
});

test('routes signPersonalMessage through the registered feature method', async () => {
  const features = createWalrusWalletFeatures({
    connect: async () => ({ accounts: [] }),
    disconnect: async () => {},
    on: () => () => {},
    signAndExecuteTransaction: async () => {
      throw new Error('not called');
    },
    signPersonalMessage: async () => ({
      bytes: 'message-bytes',
      signature: 'message-signature',
    }),
    signTransaction: async () => {
      throw new Error('not called');
    },
  });

  assert.deepEqual(
    await features['sui:signPersonalMessage'].signPersonalMessage({} as never),
    { bytes: 'message-bytes', signature: 'message-signature' },
  );
});
