import assert from 'node:assert/strict';
import test from 'node:test';

import { Transaction } from '@mysten/sui/transactions';

import { createProtocolMessage, parseProtocolMessage } from '../../walrus-connect-route-internal/src/utils/message.ts';
import {
  requirePendingSignTransaction,
  validateFinalizedDigest,
  validateProtocolMessageFresh,
  validateSubmittedDigest,
} from '../../walrus-connect-route-internal/src/utils/signProtocol.ts';
import type { WalrusConnectGrpcClient } from '../../walrus-connect-route-internal/src/utils/suiClient.ts';

test('rejects sign response without a pending transaction', () => {
  assert.deepEqual(requirePendingSignTransaction(undefined), {
    ok: false,
    error: {
      code: 'invalid_payload',
      message: 'Sign response has no pending transaction',
      phase: 'signature_verify',
    },
  });
});

test('rechecks protocol freshness before signing', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'sign.transaction',
    payload: { bytes: 'tx-bytes' },
    now: 1000,
    expiresAt: 2000,
  });
  const message = parseProtocolMessage(raw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.transaction',
    now: 1500,
  });

  assert.deepEqual(validateProtocolMessageFresh(message, 2000), {
    ok: false,
    error: {
      code: 'message_expired',
      message: 'Protocol message expired before signing',
      phase: 'sign',
    },
  });
});

test('rejects submitted digest mismatch against scanner-computed digest', async () => {
  assert.deepEqual(
    await validateSubmittedDigest({
      tx: new Transaction(),
      client: {} as WalrusConnectGrpcClient,
      submittedDigest: 'other-digest',
      getTransactionDigest: async () => 'computed-digest',
    }),
    {
      ok: false,
      error: {
        code: 'transaction_failed',
        message: 'Submitted transaction digest does not match transaction',
        phase: 'submitted',
        digest: 'other-digest',
      },
    },
  );
});

test('accepts submitted digest matching the scanner-computed digest', async () => {
  assert.deepEqual(
    await validateSubmittedDigest({
      tx: new Transaction(),
      client: {} as WalrusConnectGrpcClient,
      submittedDigest: 'computed-digest',
      getTransactionDigest: async () => 'computed-digest',
    }),
    { ok: true, digest: 'computed-digest' },
  );
});

test('rejects finalized digest mismatch', () => {
  assert.deepEqual(
    validateFinalizedDigest({
      submittedDigest: 'submitted-digest',
      finalizedDigest: 'other-digest',
    }),
    {
      ok: false,
      error: {
        code: 'transaction_failed',
        message: 'Finalized transaction digest does not match submission',
        phase: 'finality',
        digest: 'other-digest',
      },
    },
  );
});
