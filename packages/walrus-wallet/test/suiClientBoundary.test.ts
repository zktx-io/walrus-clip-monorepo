import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  createWalrusWalletSuiClient,
  executeWalrusWalletTransaction,
  getWalrusWalletFullnodeUrl,
  readEpochFromWalrusWalletClient,
  waitForWalrusWalletTransaction,
} = await jiti.import<typeof import('../src/utils/suiClient.ts')>(
  '../src/utils/suiClient.ts',
);

type FakeCore = {
  executeTransaction?: (input: unknown) => Promise<unknown>;
  waitForTransaction?: (input: unknown) => Promise<unknown>;
  getCurrentSystemState?: () => Promise<unknown>;
};

const fakeClient = (core: FakeCore) =>
  ({ core }) as unknown as ReturnType<typeof createWalrusWalletSuiClient>;

test('wallet Sui client boundary owns fullnode URL selection', () => {
  assert.equal(
    getWalrusWalletFullnodeUrl('mainnet'),
    'https://fullnode.mainnet.sui.io:443',
  );
  assert.equal(
    getWalrusWalletFullnodeUrl('testnet'),
    'https://fullnode.testnet.sui.io:443',
  );
  assert.equal(
    getWalrusWalletFullnodeUrl('devnet'),
    'https://fullnode.devnet.sui.io:443',
  );
});

test('createWalrusWalletSuiClient routes each network to the matching JSON-RPC client', () => {
  const mainnetClient = createWalrusWalletSuiClient('mainnet');
  assert.equal(mainnetClient.network, 'mainnet');

  const testnetClient = createWalrusWalletSuiClient('testnet');
  assert.equal(testnetClient.network, 'testnet');

  const devnetClient = createWalrusWalletSuiClient('devnet');
  assert.equal(devnetClient.network, 'devnet');
});

test('executeWalrusWalletTransaction preserves the digest of a successful Core API result', async () => {
  let receivedInput: { transaction?: unknown; signatures?: unknown } = {};
  const client = fakeClient({
    executeTransaction: async (input) => {
      receivedInput = input as typeof receivedInput;
      return {
        $kind: 'Transaction',
        Transaction: { digest: 'digest-success' },
      };
    },
  });

  const txBytes = new Uint8Array([1, 2, 3]);
  const result = await executeWalrusWalletTransaction(client, {
    bytes: txBytes,
    signature: 'sig-1',
  });

  assert.deepEqual(result, { digest: 'digest-success', errors: [] });
  assert.deepEqual(receivedInput.transaction, txBytes);
  assert.deepEqual(receivedInput.signatures, ['sig-1']);
});

test('executeWalrusWalletTransaction preserves the digest and surfaces the failure message on FailedTransaction', async () => {
  const client = fakeClient({
    executeTransaction: async () => ({
      $kind: 'FailedTransaction',
      FailedTransaction: {
        digest: 'digest-failed',
        status: { success: false, error: { message: 'Move abort 5' } },
      },
    }),
  });

  const result = await executeWalrusWalletTransaction(client, {
    bytes: new Uint8Array([4]),
    signature: 'sig-1',
  });

  assert.equal(result.digest, 'digest-failed');
  assert.deepEqual(result.errors, ['Move abort 5']);
});

test('waitForWalrusWalletTransaction surfaces effects.bcs as the rawEffects byte payload', async () => {
  const expectedBytes = new Uint8Array([9, 9, 9]);
  let receivedInput: { digest?: unknown; include?: unknown; timeout?: unknown } =
    {};
  const client = fakeClient({
    waitForTransaction: async (input) => {
      receivedInput = input as typeof receivedInput;
      return {
        $kind: 'Transaction',
        Transaction: { effects: { bcs: expectedBytes } },
      };
    },
  });

  const result = await waitForWalrusWalletTransaction(client, {
    digest: 'digest-1',
    timeout: 1234,
  });

  assert.equal(receivedInput.digest, 'digest-1');
  assert.deepEqual(receivedInput.include, { effects: true });
  assert.equal(receivedInput.timeout, 1234);
  assert.equal(result.rawEffects, expectedBytes);
});

test('waitForWalrusWalletTransaction throws when effects.bcs is missing so callers can preserve the digest in an uncertainty error', async () => {
  const client = fakeClient({
    waitForTransaction: async () => ({
      $kind: 'Transaction',
      Transaction: { effects: { bcs: null } },
    }),
  });

  await assert.rejects(
    () =>
      waitForWalrusWalletTransaction(client, {
        digest: 'digest-missing-effects',
      }),
    /effects\.bcs is missing/,
  );
});

test('readEpochFromWalrusWalletClient returns systemState.epoch verbatim so zkLogin expiry comparisons via Number(epoch) stay valid', async () => {
  let getCurrentSystemStateCalls = 0;
  const client = fakeClient({
    getCurrentSystemState: async () => {
      getCurrentSystemStateCalls += 1;
      return { systemState: { epoch: '12345' } };
    },
  });

  const epoch = await readEpochFromWalrusWalletClient(client);

  assert.equal(getCurrentSystemStateCalls, 1);
  assert.equal(epoch, '12345');
  assert.equal(typeof epoch, 'string');
  assert.equal(Number(epoch), 12345);
});

test('waitForWalrusWalletTransaction still extracts effects from a FailedTransaction so finality observation is preserved', async () => {
  const expectedBytes = new Uint8Array([1, 2]);
  const client = fakeClient({
    waitForTransaction: async () => ({
      $kind: 'FailedTransaction',
      FailedTransaction: {
        digest: 'digest-failed-wait',
        effects: { bcs: expectedBytes },
      },
    }),
  });

  const result = await waitForWalrusWalletTransaction(client, {
    digest: 'digest-failed-wait',
  });

  assert.equal(result.rawEffects, expectedBytes);
});
