import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProtocolMessage,
  parseProtocolMessage,
  ProtocolMessageError,
} from '../../walrus-connect-route-internal/src/utils/message.ts';

const assertProtocolError = (
  fn: () => unknown,
  expectedCode: string,
) => {
  assert.throws(fn, (error) => {
    assert.ok(error instanceof ProtocolMessageError);
    assert.equal(error.payload.code, expectedCode);
    return true;
  });
};

test('parses a valid protocol v1 message', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'sign.address',
    payload: { address: '0x1' },
    now: 1000,
  });

  const parsed = parseProtocolMessage(raw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.address',
    now: 1001,
  });

  assert.equal(parsed.version, 1);
  assert.equal(parsed.sessionId, 'session-1');
  assert.equal(parsed.network, 'testnet');
  assert.equal(parsed.sequence, 1);
  assert.equal(parsed.type, 'sign.address');
  assert.deepEqual(parsed.payload, { address: '0x1' });
});

test('rejects missing or zero protocol sequence', () => {
  assertProtocolError(
    () =>
      createProtocolMessage({
        sessionId: 'session-1',
        network: 'testnet',
        type: 'sign.address',
        payload: { address: '0x1' },
      } as never),
    'invalid_envelope',
  );

  assertProtocolError(
    () =>
      createProtocolMessage({
        sessionId: 'session-1',
        network: 'testnet',
        sequence: 0,
        type: 'sign.address',
        payload: { address: '0x1' },
      }),
    'invalid_envelope',
  );
});

test('rejects a session mismatch', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'sign.address',
    payload: { address: '0x1' },
    now: 1000,
  });

  assertProtocolError(
    () =>
      parseProtocolMessage(raw, {
        expectedSessionId: 'session-2',
        expectedNetwork: 'testnet',
        expectedType: 'sign.address',
        now: 1001,
      }),
    'session_mismatch',
  );
});

test('rejects a network mismatch', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'mainnet',
    sequence: 1,
    type: 'sign.address',
    payload: { address: '0x1' },
    now: 1000,
  });

  assertProtocolError(
    () =>
      parseProtocolMessage(raw, {
        expectedSessionId: 'session-1',
        expectedNetwork: 'testnet',
        expectedType: 'sign.address',
        now: 1001,
      }),
    'network_mismatch',
  );
});

test('rejects legacy type/value messages', () => {
  assertProtocolError(
    () =>
      parseProtocolMessage(JSON.stringify({ type: 'STEP_0', value: '0x1' }), {
        expectedSessionId: 'session-1',
        expectedNetwork: 'testnet',
        expectedType: 'sign.address',
      }),
    'invalid_envelope',
  );
});

test('rejects extra transaction bytes in sign response payload', () => {
  assertProtocolError(
    () =>
      createProtocolMessage({
        sessionId: 'session-1',
        network: 'testnet',
        sequence: 1,
        type: 'sign.response',
        payload: {
          signature: 'sig',
          txBytes: 'unexpected',
        } as never,
      }),
    'invalid_payload',
  );
});

test('parses sign submitted and finalized messages', () => {
  const submittedRaw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'sign.submitted',
    payload: { digest: 'digest-1' },
    now: 1000,
  });
  const finalizedRaw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 2,
    type: 'sign.finalized',
    payload: { digest: 'digest-1', effects: 'effects-1' },
    now: 1000,
  });

  const submitted = parseProtocolMessage(submittedRaw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.submitted',
    now: 1001,
  });
  const finalized = parseProtocolMessage(finalizedRaw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.finalized',
    now: 1001,
  });

  assert.equal(submitted.type, 'sign.submitted');
  assert.deepEqual(submitted.payload, { digest: 'digest-1' });
  assert.equal(finalized.type, 'sign.finalized');
  assert.deepEqual(finalized.payload, {
    digest: 'digest-1',
    effects: 'effects-1',
  });
});

test('parses milestone and terminal acknowledgement messages', () => {
  const submittedAckRaw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 2,
    type: 'sign.submitted.ack',
    payload: { digest: 'digest-1', ackSequence: 1 },
    now: 1000,
  });
  const finalizedAckRaw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 3,
    type: 'sign.finalized.ack',
    payload: { digest: 'digest-1', ackSequence: 2 },
    now: 1000,
  });
  const errorAckRaw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 4,
    type: 'protocol.error.ack',
    payload: { code: 'transaction_failed', ackSequence: 3 },
    now: 1000,
  });

  const submittedAck = parseProtocolMessage(submittedAckRaw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.submitted.ack',
    now: 1001,
  });
  const finalizedAck = parseProtocolMessage(finalizedAckRaw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.finalized.ack',
    now: 1001,
  });
  const errorAck = parseProtocolMessage(errorAckRaw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'protocol.error.ack',
    now: 1001,
  });

  assert.deepEqual(submittedAck.payload, {
    digest: 'digest-1',
    ackSequence: 1,
  });
  assert.deepEqual(finalizedAck.payload, {
    digest: 'digest-1',
    ackSequence: 2,
  });
  assert.deepEqual(errorAck.payload, {
    code: 'transaction_failed',
    ackSequence: 3,
  });
});

test('rejects legacy sign acknowledgement messages', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'sign.submitted',
    payload: { digest: 'digest-1' },
    now: 1000,
  });

  assertProtocolError(
    () =>
      parseProtocolMessage(raw, {
        expectedSessionId: 'session-1',
        expectedNetwork: 'testnet',
        expectedType: 'sign.ack' as never,
        now: 1001,
      }),
    'type_mismatch',
  );
});

test('parses a login acknowledgement', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'login.result.ack',
    payload: { accepted: true, ackSequence: 1 },
    now: 1000,
  });

  const parsed = parseProtocolMessage(raw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'login.result.ack',
    now: 1001,
  });

  assert.equal(parsed.type, 'login.result.ack');
  assert.deepEqual(parsed.payload, { accepted: true, ackSequence: 1 });
});

test('parses a structured session timeout error', () => {
  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'protocol.error',
    payload: {
      code: 'session_timeout',
      message: 'Timed out waiting for login result',
      details: { phase: 'login_result' },
    },
    now: 1000,
  });

  const parsed = parseProtocolMessage(raw, {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'protocol.error',
    now: 1001,
  });

  assert.equal(parsed.type, 'protocol.error');
  assert.equal(parsed.payload.code, 'session_timeout');
});
