import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

import {
  createProtocolMessage,
  parseProtocolMessage,
  type ProtocolEnvelope,
  type ProtocolMessageType,
} from '../src/utils/message.ts';
import type { LoginHostSessionDeps } from '../src/protocol/loginHostSession.ts';
import type { ProtocolTransport } from '../src/protocol/session.ts';

const jiti = createJiti(import.meta.url);
const {
  LoginHostOutcomeError,
  loginHostOutcomeToResult,
  startLoginHostSession,
} = await jiti.import<{
  LoginHostOutcomeError: typeof import('../src/protocol/loginHostSession.ts').LoginHostOutcomeError;
  loginHostOutcomeToResult: typeof import('../src/protocol/loginHostSession.ts').loginHostOutcomeToResult;
  startLoginHostSession: typeof import('../src/protocol/loginHostSession.ts').startLoginHostSession;
}>('../src/protocol/loginHostSession.ts');
const { startLoginScannerSession } = await jiti.import<{
  startLoginScannerSession: typeof import('../src/protocol/loginScannerSession.ts').startLoginScannerSession;
}>('../src/protocol/loginScannerSession.ts');

class FakeTransport implements ProtocolTransport {
  sent: string[] = [];
  closed = false;
  closeReason: string | undefined;
  onSend?: (raw: string, transport: FakeTransport) => void;
  #messageHandlers: Array<(raw: unknown) => void> = [];
  #closeHandlers: Array<() => void> = [];
  #errorHandlers: Array<(error: Error) => void> = [];

  constructor(onSend?: (raw: string, transport: FakeTransport) => void) {
    this.onSend = onSend;
  }

  send(raw: string) {
    if (this.closed) throw new Error('transport closed');
    this.sent.push(raw);
    this.onSend?.(raw, this);
  }

  close(reason?: string) {
    this.closed = true;
    this.closeReason = reason;
  }

  isOpen() {
    return !this.closed;
  }

  onMessage(handler: (raw: unknown) => void) {
    this.#messageHandlers.push(handler);
    return () => {
      this.#messageHandlers = this.#messageHandlers.filter(
        (item) => item !== handler,
      );
    };
  }

  onClose(handler: () => void) {
    this.#closeHandlers.push(handler);
    return () => {
      this.#closeHandlers = this.#closeHandlers.filter(
        (item) => item !== handler,
      );
    };
  }

  onError(handler: (error: Error) => void) {
    this.#errorHandlers.push(handler);
    return () => {
      this.#errorHandlers = this.#errorHandlers.filter(
        (item) => item !== handler,
      );
    };
  }

  emitMessage(raw: unknown) {
    for (const handler of this.#messageHandlers) handler(raw);
  }

  emitClose() {
    for (const handler of this.#closeHandlers) handler();
  }
}

const sessionId = 'session-1';
const network = 'testnet';
const challenge = 'login-challenge';
const address = `0x${'2'.repeat(64)}`;

const protocolMessageTypes = [
  'login.proof',
  'login.result',
  'login.result.ack',
  'sign.address',
  'sign.transaction',
  'sign.response',
  'sign.submitted',
  'sign.submitted.ack',
  'sign.finalized',
  'sign.finalized.ack',
  'protocol.error',
  'protocol.error.ack',
] as const satisfies readonly ProtocolMessageType[];

const payloadFor = <TType extends ProtocolMessageType>(
  type: TType,
): ProtocolEnvelope<TType>['payload'] => {
  switch (type) {
    case 'login.proof':
      return {
        address,
        publicKey: 'public-key-1',
        signature: 'signature-1',
        challenge,
      } as ProtocolEnvelope<TType>['payload'];
    case 'login.result':
      return {
        accepted: true,
        address,
      } as ProtocolEnvelope<TType>['payload'];
    case 'login.result.ack':
      return {
        accepted: true,
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.address':
      return { address } as ProtocolEnvelope<TType>['payload'];
    case 'sign.transaction':
      return { bytes: 'bytes-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.response':
      return { signature: 'signature-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.submitted':
      return { digest: 'digest-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.submitted.ack':
      return {
        digest: 'digest-1',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.finalized':
      return {
        digest: 'digest-1',
        effects: 'effects-1',
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.finalized.ack':
      return {
        digest: 'digest-1',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'protocol.error':
      return {
        code: 'transaction_rejected',
        message: 'remote rejected',
      } as ProtocolEnvelope<TType>['payload'];
    case 'protocol.error.ack':
      return {
        code: 'transaction_rejected',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
  }
};

const waitFor = async (predicate: () => boolean, label: string) => {
  for (let index = 0; index < 50; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

const parseSent = <TType extends ProtocolMessageType>(
  raw: string,
  expectedType: TType,
) =>
  parseProtocolMessage(raw, {
    expectedSessionId: sessionId,
    expectedNetwork: network,
    expectedType,
  });

const findSent = <TType extends ProtocolMessageType>(
  transport: FakeTransport,
  expectedType: TType,
) => {
  for (const raw of transport.sent) {
    try {
      return parseSent(raw, expectedType);
    } catch {}
  }
  return undefined;
};

const emitLoginInbound = <TType extends ProtocolMessageType>({
  transport,
  sequence,
  type,
  payload,
}: {
  transport: FakeTransport;
  sequence: number;
  type: TType;
  payload: ProtocolEnvelope<TType>['payload'];
}) => {
  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence,
      type,
      payload,
    }),
  );
};

const createHostDeps = (): Partial<LoginHostSessionDeps> => ({
  createClient: () => ({}) as never,
  publicKeyFromSuiBytes: async () => ({
    toSuiPublicKey: () => 'public-key-1',
  }),
  verifyPersonalMessageSignature: async () => ({
    toSuiPublicKey: () => 'public-key-1',
  }),
});

test('login host resolves connected only after login result acknowledgement', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'login.result') {
      emitLoginInbound({
        transport: currentTransport,
        sequence: 2,
        type: 'login.result.ack',
        payload: {
          accepted: true,
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];

  startLoginHostSession({
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createHostDeps(),
    ackTimeoutMs: 20,
    closeFallbackMs: 5,
  });

  emitLoginInbound({
    transport,
    sequence: 1,
    type: 'login.proof',
    payload: {
      address,
      publicKey: 'public-key-1',
      signature: 'signature-1',
      challenge,
    },
  });

  await waitFor(() => outcomes.length === 1, 'login host outcome');
  assert.deepEqual(outcomes[0], {
    type: 'connected',
    address,
    network,
  });
});

test('login host preserves accepted result when acknowledgement delivery fails', async () => {
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];

  startLoginHostSession({
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createHostDeps(),
    ackTimeoutMs: 5,
    closeFallbackMs: 5,
  });

  emitLoginInbound({
    transport,
    sequence: 1,
    type: 'login.proof',
    payload: {
      address,
      publicKey: 'public-key-1',
      signature: 'signature-1',
      challenge,
    },
  });

  await waitFor(() => outcomes.length === 1, 'login result delivery failure');
  assert.deepEqual(outcomes[0], {
    type: 'result_delivery_failed',
    address,
    network,
    reason: 'Timed out waiting for login.result.ack',
  });
});

test('login host dispose settles instead of leaving caller unresolved', async () => {
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];

  const runner = startLoginHostSession({
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createHostDeps(),
    ackTimeoutMs: 5,
    closeFallbackMs: 5,
  });

  runner.dispose();

  await waitFor(() => outcomes.length === 1, 'login dispose outcome');
  assert.deepEqual(outcomes[0], {
    type: 'failed',
    reason: 'transaction_rejected: Login session disposed',
  });
});

test('login host dispose preserves accepted result while awaiting acknowledgement', async () => {
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const runner = startLoginHostSession({
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createHostDeps(),
    ackTimeoutMs: 100,
    closeFallbackMs: 5,
  });

  emitLoginInbound({
    transport,
    sequence: 1,
    type: 'login.proof',
    payload: {
      address,
      publicKey: 'public-key-1',
      signature: 'signature-1',
      challenge,
    },
  });
  await waitFor(
    () => findSent(transport, 'login.result') !== undefined,
    'login.result',
  );

  runner.dispose();

  await waitFor(() => outcomes.length === 1, 'login result dispose outcome');
  assert.deepEqual(outcomes[0], {
    type: 'result_delivery_failed',
    address,
    network,
    reason: 'Login session disposed',
  });
});

test('login scanner accepts synchronous result during proof delivery', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'login.proof') {
      emitLoginInbound({
        transport: currentTransport,
        sequence: 1,
        type: 'login.result',
        payload: {
          accepted: true,
          address,
        },
      });
    }
  });

  startLoginScannerSession({
    signer: {
      getAddress: () => address,
      getPublicKey: () => ({
        toSuiPublicKey: () => 'public-key-1',
      }),
      signPersonalMessage: async () => ({
        signature: 'signature-1',
      }),
    } as never,
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    resultTimeoutMs: 100,
    ackTimeoutMs: 20,
    closeFallbackMs: 5,
  });

  await waitFor(
    () => findSent(transport, 'login.result.ack') !== undefined,
    'login.result.ack',
  );

  const ack = findSent(transport, 'login.result.ack');
  assert.equal(ack?.payload.accepted, true);
  assert.equal(ack?.payload.ackSequence, 1);
});

test('login scanner keeps terminal ack delivery window for remote protocol error', async () => {
  const transport = new FakeTransport();

  startLoginScannerSession({
    signer: {
      getAddress: () => address,
      getPublicKey: () => ({
        toSuiPublicKey: () => 'public-key-1',
      }),
      signPersonalMessage: async () => ({
        signature: 'signature-1',
      }),
    } as never,
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    resultTimeoutMs: 100,
    ackTimeoutMs: 20,
    closeFallbackMs: 5,
  });

  await waitFor(
    () => findSent(transport, 'login.proof') !== undefined,
    'login.proof',
  );

  emitLoginInbound({
    transport,
    sequence: 1,
    type: 'protocol.error',
    payload: {
      code: 'verification_failed',
      message: 'host rejected proof',
    },
  });

  await waitFor(
    () => findSent(transport, 'protocol.error.ack') !== undefined,
    'protocol.error.ack',
  );

  const ack = findSent(transport, 'protocol.error.ack');
  assert.equal(ack?.payload.code, 'verification_failed');
  assert.equal(ack?.payload.ackSequence, 1);
  assert.equal(transport.closed, false);
  await waitFor(() => transport.closed, 'close fallback');
  assert.equal(transport.closeReason, 'protocol_error');
});

test('login host rejects every unexpected message before proof without going silent', async () => {
  for (const type of protocolMessageTypes) {
    if (type === 'login.proof' || type === 'protocol.error') continue;

    const transport = new FakeTransport((raw, currentTransport) => {
      const message = parseProtocolMessage(raw, {
        expectedSessionId: sessionId,
        expectedNetwork: network,
      });
      if (message.type === 'protocol.error') {
        emitLoginInbound({
          transport: currentTransport,
          sequence: 2,
          type: 'protocol.error.ack',
          payload: {
            code: message.payload.code,
            ackSequence: message.sequence,
          },
        });
      }
    });
    const outcomes: unknown[] = [];

    startLoginHostSession({
      sessionId,
      network,
      challenge,
      transport,
      onEvent: () => {},
      onFinish: (outcome) => outcomes.push(outcome),
      deps: createHostDeps(),
      ackTimeoutMs: 20,
      closeFallbackMs: 5,
    });

    emitLoginInbound({
      transport,
      sequence: 1,
      type,
      payload: payloadFor(type),
    });

    await waitFor(
      () => outcomes.length === 1,
      `login host unexpected ${type}`,
    );
    assert.deepEqual(
      outcomes[0],
      {
        type: 'failed',
        reason: 'type_mismatch: Unexpected login protocol message',
      },
      type,
    );
    assert.equal(findSent(transport, 'protocol.error')?.payload.code, 'type_mismatch');
  }
});

test('login host preserves accepted result when result ACK is invalid', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'login.result') {
      emitLoginInbound({
        transport: currentTransport,
        sequence: 2,
        type: 'sign.submitted.ack',
        payload: {
          digest: 'wrong-digest',
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];

  startLoginHostSession({
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createHostDeps(),
    ackTimeoutMs: 100,
    closeFallbackMs: 5,
  });

  emitLoginInbound({
    transport,
    sequence: 1,
    type: 'login.proof',
    payload: payloadFor('login.proof'),
  });

  await waitFor(
    () => outcomes.length === 1,
    'login invalid result ack outcome',
  );
  assert.deepEqual(outcomes[0], {
    type: 'result_delivery_failed',
    address,
    network,
    reason: 'internal_error: Invalid login protocol message',
  });
});

test('login host preserves accepted result when scanner sends terminal before ACK', async () => {
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];

  startLoginHostSession({
    sessionId,
    network,
    challenge,
    transport,
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createHostDeps(),
    ackTimeoutMs: 100,
    closeFallbackMs: 5,
  });

  emitLoginInbound({
    transport,
    sequence: 1,
    type: 'login.proof',
    payload: payloadFor('login.proof'),
  });
  await waitFor(
    () => findSent(transport, 'login.result') !== undefined,
    'login.result',
  );

  emitLoginInbound({
    transport,
    sequence: 2,
    type: 'protocol.error',
    payload: {
      code: 'verification_failed',
      message: 'scanner rejected result',
    },
  });

  await waitFor(
    () => outcomes.length === 1,
    'login result remote terminal outcome',
  );
  assert.deepEqual(outcomes[0], {
    type: 'result_delivery_failed',
    address,
    network,
    reason: 'verification_failed: scanner rejected result',
  });
  assert.equal(findSent(transport, 'protocol.error.ack')?.payload.ackSequence, 2);
});

test('login public boundary helper does not collapse partial outcome', () => {
  const outcome = {
    type: 'result_delivery_failed' as const,
    address,
    network,
    reason: 'Connection closed before login acknowledgement.',
  };
  const error = new LoginHostOutcomeError(outcome);

  assert.equal(loginHostOutcomeToResult(outcome), undefined);
  assert.equal(error.message, outcome.reason);
  assert.equal(error.outcome, outcome);
});

test('login scanner rejects every unexpected result message without going silent', async () => {
  for (const type of protocolMessageTypes) {
    if (type === 'login.result' || type === 'protocol.error') continue;

    const transport = new FakeTransport();
    const events: Array<{ variant: string; message: string }> = [];
    const runner = startLoginScannerSession({
      signer: {
        getAddress: () => address,
        getPublicKey: () => ({
          toSuiPublicKey: () => 'public-key-1',
        }),
        signPersonalMessage: async () => ({
          signature: 'signature-1',
        }),
      } as never,
      sessionId,
      network,
      challenge,
      transport,
      onEvent: (event) => events.push(event),
      resultTimeoutMs: 100,
      ackTimeoutMs: 20,
      closeFallbackMs: 5,
    });

    await waitFor(
      () => findSent(transport, 'login.proof') !== undefined,
      `login.proof for unexpected ${type}`,
    );

    emitLoginInbound({
      transport,
      sequence: 1,
      type,
      payload: payloadFor(type),
    });

    await waitFor(
      () => findSent(transport, 'protocol.error') !== undefined,
      `login scanner protocol.error for ${type}`,
    );
    assert.equal(findSent(transport, 'protocol.error')?.payload.code, 'type_mismatch');
    assert.deepEqual(events.at(-1), {
      variant: 'error',
      message: 'type_mismatch: Unexpected login protocol message',
    });
    runner.dispose();
  }
});
