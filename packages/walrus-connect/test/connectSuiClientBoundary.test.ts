import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  executeWalrusConnectTransaction,
  getWalrusConnectFullnodeUrl,
  waitForWalrusConnectTransaction,
} = await jiti.import<
  typeof import('../../walrus-connect-route-internal/src/utils/suiClient.ts')
>('../../walrus-connect-route-internal/src/utils/suiClient.ts');

type FakeCore = {
  executeTransaction?: (input: unknown) => Promise<unknown>;
  waitForTransaction?: (input: unknown) => Promise<unknown>;
};

type FakeClient = Parameters<typeof executeWalrusConnectTransaction>[0];

const fakeClient = (core: FakeCore) => ({ core }) as unknown as FakeClient;

test('QR route Sui client owner returns the JSON-RPC fullnode URL per network', () => {
  assert.equal(
    getWalrusConnectFullnodeUrl('mainnet'),
    'https://fullnode.mainnet.sui.io:443',
  );
  assert.equal(
    getWalrusConnectFullnodeUrl('testnet'),
    'https://fullnode.testnet.sui.io:443',
  );
  assert.equal(
    getWalrusConnectFullnodeUrl('devnet'),
    'https://fullnode.devnet.sui.io:443',
  );
});

test('executeWalrusConnectTransaction returns the digest from the Core API success result without re-encoding the bytes', async () => {
  let receivedInput: { transaction?: unknown; signatures?: unknown } = {};
  const client = fakeClient({
    executeTransaction: async (input) => {
      receivedInput = input as typeof receivedInput;
      return {
        $kind: 'Transaction',
        Transaction: { digest: 'digest-qr-success' },
      };
    },
  });

  const txBytes = new Uint8Array([10, 20, 30]);
  const result = await executeWalrusConnectTransaction(client, {
    bytes: txBytes,
    signature: 'qr-sig',
  });

  assert.deepEqual(result, { digest: 'digest-qr-success', errors: [] });
  assert.equal(receivedInput.transaction, txBytes);
  assert.deepEqual(receivedInput.signatures, ['qr-sig']);
});

test('executeWalrusConnectTransaction preserves the digest of a Core API FailedTransaction', async () => {
  const client = fakeClient({
    executeTransaction: async () => ({
      $kind: 'FailedTransaction',
      FailedTransaction: {
        digest: 'digest-qr-failed',
        status: {
          success: false,
          error: { message: 'CongestedObjects: shared object congested' },
        },
      },
    }),
  });

  const result = await executeWalrusConnectTransaction(client, {
    bytes: new Uint8Array([4]),
    signature: 'qr-sig',
  });

  assert.equal(result.digest, 'digest-qr-failed');
  assert.deepEqual(result.errors, [
    'CongestedObjects: shared object congested',
  ]);
});

test('waitForWalrusConnectTransaction returns effects.bcs and forwards include/timeout to the Core API', async () => {
  const expectedBytes = new Uint8Array([7, 7, 7]);
  let receivedInput: {
    digest?: unknown;
    include?: unknown;
    timeout?: unknown;
  } = {};
  const client = fakeClient({
    waitForTransaction: async (input) => {
      receivedInput = input as typeof receivedInput;
      return {
        $kind: 'Transaction',
        Transaction: { effects: { bcs: expectedBytes } },
      };
    },
  });

  const result = await waitForWalrusConnectTransaction(client, {
    digest: 'digest-finality',
    timeout: 4321,
  });

  assert.equal(receivedInput.digest, 'digest-finality');
  assert.deepEqual(receivedInput.include, { effects: true });
  assert.equal(receivedInput.timeout, 4321);
  assert.equal(result.rawEffects, expectedBytes);
});

test('waitForWalrusConnectTransaction throws when the Core API result has no effects.bcs so the runner surfaces uncertainty instead of empty effects', async () => {
  const client = fakeClient({
    waitForTransaction: async () => ({
      $kind: 'Transaction',
      Transaction: { effects: { bcs: null } },
    }),
  });

  await assert.rejects(
    () =>
      waitForWalrusConnectTransaction(client, {
        digest: 'digest-finality-empty',
      }),
    /effects\.bcs is missing/,
  );
});
