import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createProtocolMessage,
  parseProtocolMessage,
} from '../src/utils/message.ts';
import {
  ProtocolSequenceError,
  ProtocolSession,
  ProtocolSessionClosedError,
  type ProtocolTransport,
} from '../src/protocol/session.ts';

const codec = {
  createMessage: createProtocolMessage,
  parseMessage: parseProtocolMessage,
};

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

  emitError(error: Error) {
    for (const handler of this.#errorHandlers) handler(error);
  }

  handlerCount() {
    return (
      this.#messageHandlers.length +
      this.#closeHandlers.length +
      this.#errorHandlers.length
    );
  }
}

const createSession = (
  transport: FakeTransport,
  options: Partial<ConstructorParameters<typeof ProtocolSession>[0]> = {},
) =>
  new ProtocolSession({
    sessionId: 'session-1',
    network: 'testnet',
    transport,
    codec,
    ...options,
  });

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

test('waits for protocol error ack before closing terminal session', async () => {
  const transport = new FakeTransport();
  const session = createSession(transport);

  const waitForAck = session.sendAndWaitForAck({
    type: 'protocol.error',
    payload: {
      code: 'transaction_failed',
      message: 'failed',
    },
    expectedAckType: 'protocol.error.ack',
    timeoutMs: 1000,
    closeOnAck: true,
    validateAck: (message) =>
      message.payload.code === 'transaction_failed',
  });

  assert.equal(transport.closed, false);
  assert.equal(transport.sent.length, 1);

  const sent = parseProtocolMessage(transport.sent[0], {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'protocol.error',
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'protocol.error.ack',
      payload: {
        code: 'transaction_failed',
        ackSequence: sent.sequence,
      },
    }),
  );

  const result = await waitForAck;
  assert.equal(result.message.sequence, sent.sequence);
  assert.equal(result.ack.type, 'protocol.error.ack');
  assert.equal(transport.closed, true);
  assert.equal(session.terminalReason, 'success');
});

test('terminal send blocks ordinary sends before acknowledgement', async () => {
  const transport = new FakeTransport();
  const session = createSession(transport);

  const waitForAck = session.sendAndWaitForAck({
    type: 'protocol.error',
    payload: {
      code: 'transaction_failed',
      message: 'failed',
    },
    expectedAckType: 'protocol.error.ack',
    timeoutMs: 1000,
    closeOnAck: true,
    validateAck: (message) =>
      message.payload.code === 'transaction_failed',
  });

  assert.equal(session.isActive(), false);
  assert.throws(
    () => session.send('sign.address', { address: '0x1' }),
    (error: unknown) => {
      assert.ok(error instanceof ProtocolSessionClosedError);
      assert.equal(error.reason, 'success');
      return true;
    },
  );

  const sent = parseProtocolMessage(transport.sent[0], {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'protocol.error',
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'protocol.error.ack',
      payload: {
        code: 'transaction_failed',
        ackSequence: sent.sequence,
      },
    }),
  );

  await waitForAck;
  assert.equal(transport.closed, true);
});

test('handles acknowledgement delivered synchronously during send', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const sent = parseProtocolMessage(raw, {
      expectedSessionId: 'session-1',
      expectedNetwork: 'testnet',
      expectedType: 'protocol.error',
    });

    currentTransport.emitMessage(
      createProtocolMessage({
        sessionId: 'session-1',
        network: 'testnet',
        sequence: 1,
        type: 'protocol.error.ack',
        payload: {
          code: sent.payload.code,
          ackSequence: sent.sequence,
        },
      }),
    );
  });
  const session = createSession(transport);

  const result = await session.sendAndWaitForAck({
    type: 'protocol.error',
    payload: {
      code: 'transaction_failed',
      message: 'failed',
    },
    expectedAckType: 'protocol.error.ack',
    timeoutMs: 1000,
    validateAck: (message) => message.payload.code === 'transaction_failed',
  });

  assert.equal(result.ack.type, 'protocol.error.ack');
  assert.equal(result.ack.payload.ackSequence, result.message.sequence);
});

test('rejects duplicate or late inbound sequence before delivery', async () => {
  const transport = new FakeTransport();
  const received: string[] = [];
  const errors: Error[] = [];
  createSession(transport, {
    onMessage: (message) => {
      received.push(message.type);
    },
    onError: (error) => {
      errors.push(error);
    },
  });

  const raw = createProtocolMessage({
    sessionId: 'session-1',
    network: 'testnet',
    sequence: 1,
    type: 'sign.address',
    payload: { address: '0x1' },
  });

  transport.emitMessage(raw);
  transport.emitMessage(raw);
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(received, ['sign.address']);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof ProtocolSequenceError);
});

test('serializes application messages in inbound order', async () => {
  const transport = new FakeTransport();
  const firstMessage = createDeferred();
  const events: string[] = [];
  createSession(transport, {
    onMessage: async (message) => {
      events.push(`start:${message.sequence}`);
      if (message.sequence === 1) {
        await firstMessage.promise;
      }
      events.push(`finish:${message.sequence}`);
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'sign.address',
      payload: { address: '0x1' },
    }),
  );
  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 2,
      type: 'sign.address',
      payload: { address: '0x2' },
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['start:1']);

  firstMessage.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['start:1', 'finish:1', 'start:2', 'finish:2']);
});

test('resolves pending acknowledgement while an app handler is in flight', async () => {
  const transport = new FakeTransport();
  const firstMessage = createDeferred();
  const events: string[] = [];
  const session = createSession(transport, {
    onMessage: async (message) => {
      events.push(`start:${message.sequence}`);
      await firstMessage.promise;
      events.push(`finish:${message.sequence}`);
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'sign.address',
      payload: { address: '0x1' },
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['start:1']);

  const waitForAck = session.sendAndWaitForAck({
    type: 'sign.submitted',
    payload: { digest: 'digest-1' },
    expectedAckType: 'sign.submitted.ack',
    timeoutMs: 1000,
    validateAck: (message) => message.payload.digest === 'digest-1',
  });
  const sent = parseProtocolMessage(transport.sent[0], {
    expectedSessionId: 'session-1',
    expectedNetwork: 'testnet',
    expectedType: 'sign.submitted',
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 2,
      type: 'sign.submitted.ack',
      payload: {
        digest: 'digest-1',
        ackSequence: sent.sequence,
      },
    }),
  );

  const result = await waitForAck;
  assert.equal(result.ack.type, 'sign.submitted.ack');
  assert.deepEqual(events, ['start:1']);

  firstMessage.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['start:1', 'finish:1']);
});

test('protocol error bypasses app queue and prevents later app delivery', async () => {
  const transport = new FakeTransport();
  const firstMessage = createDeferred();
  const events: string[] = [];
  let session!: ProtocolSession;
  session = createSession(transport, {
    onMessage: async (message) => {
      if (message.type === 'protocol.error') {
        events.push('terminal');
        session.sendAck(message, 'protocol.error.ack', {
          code: message.payload.code,
          ackSequence: message.sequence,
        });
        return;
      }

      events.push(`start:${message.sequence}`);
      if (message.sequence === 1) {
        await firstMessage.promise;
      }
      events.push(`finish:${message.sequence}`);
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'sign.address',
      payload: { address: '0x1' },
    }),
  );
  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 2,
      type: 'sign.address',
      payload: { address: '0x2' },
    }),
  );
  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 3,
      type: 'protocol.error',
      payload: {
        code: 'transaction_failed',
        message: 'remote terminal',
      },
    }),
  );
  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 4,
      type: 'sign.address',
      payload: { address: '0x4' },
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['start:1', 'terminal']);
  assert.equal(transport.sent.length, 1);
  assert.equal(
    parseProtocolMessage(transport.sent[0], {
      expectedSessionId: 'session-1',
      expectedNetwork: 'testnet',
      expectedType: 'protocol.error.ack',
    }).payload.ackSequence,
    3,
  );

  firstMessage.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['start:1', 'terminal', 'finish:1']);
});

test('remote protocol error blocks ordinary sends but still allows its ack', async () => {
  const transport = new FakeTransport();
  const events: string[] = [];
  let ordinarySendError: unknown;
  let session!: ProtocolSession;

  session = createSession(transport, {
    onMessage: (message) => {
      if (message.type !== 'protocol.error') return;

      events.push(session.isActive() ? 'active' : 'inactive');
      try {
        session.send('sign.address', { address: '0x1' });
      } catch (error) {
        ordinarySendError = error;
      }
      session.sendAck(message, 'protocol.error.ack', {
        code: message.payload.code,
        ackSequence: message.sequence,
      });
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'protocol.error',
      payload: {
        code: 'transaction_failed',
        message: 'remote terminal',
      },
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(events, ['inactive']);
  assert.ok(ordinarySendError instanceof ProtocolSessionClosedError);
  assert.equal(ordinarySendError.reason, 'protocol_error');
  assert.equal(transport.sent.length, 1);
  assert.equal(
    parseProtocolMessage(transport.sent[0], {
      expectedSessionId: 'session-1',
      expectedNetwork: 'testnet',
      expectedType: 'protocol.error.ack',
    }).payload.ackSequence,
    1,
  );
});

test('remote protocol error rejects pending acknowledgement immediately', async () => {
  const transport = new FakeTransport();
  let session!: ProtocolSession;

  session = createSession(transport, {
    onMessage: (message) => {
      if (message.type !== 'protocol.error') return;

      session.sendAck(message, 'protocol.error.ack', {
        code: message.payload.code,
        ackSequence: message.sequence,
      });
    },
  });

  const waitForAck = session.sendAndWaitForAck({
    type: 'sign.finalized',
    payload: {
      digest: 'digest-1',
      effects: 'effects-1',
    },
    expectedAckType: 'sign.finalized.ack',
    timeoutMs: 1000,
  });
  const rejection = assert.rejects(waitForAck, (error) => {
    assert.ok(error instanceof ProtocolSessionClosedError);
    assert.equal(error.reason, 'protocol_error');
    return true;
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'protocol.error',
      payload: {
        code: 'transaction_failed',
        message: 'remote terminal',
      },
    }),
  );

  await rejection;
  assert.equal(session.isActive(), false);
  assert.equal(transport.closed, false);
  assert.equal(transport.sent.length, 2);
  assert.equal(
    parseProtocolMessage(transport.sent[1], {
      expectedSessionId: 'session-1',
      expectedNetwork: 'testnet',
      expectedType: 'protocol.error.ack',
    }).payload.ackSequence,
    1,
  );
});

test('remote protocol error during terminal ack wait rejects local terminal wait', async () => {
  const transport = new FakeTransport();
  let session!: ProtocolSession;

  session = createSession(transport, {
    onMessage: (message) => {
      if (message.type !== 'protocol.error') return;

      session.sendAck(message, 'protocol.error.ack', {
        code: message.payload.code,
        ackSequence: message.sequence,
      });
    },
  });

  const waitForAck = session.sendAndWaitForAck({
    type: 'protocol.error',
    payload: {
      code: 'transaction_failed',
      message: 'local terminal',
    },
    expectedAckType: 'protocol.error.ack',
    timeoutMs: 1000,
    closeOnAck: true,
    validateAck: (message) => message.payload.code === 'transaction_failed',
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'protocol.error',
      payload: {
        code: 'transaction_rejected',
        message: 'remote terminal',
      },
    }),
  );

  await assert.rejects(waitForAck, (error) => {
    assert.ok(error instanceof ProtocolSessionClosedError);
    assert.equal(error.reason, 'protocol_error');
    return true;
  });
  assert.equal(session.isActive(), false);
  assert.equal(transport.sent.length, 2);
  assert.equal(
    parseProtocolMessage(transport.sent[1], {
      expectedSessionId: 'session-1',
      expectedNetwork: 'testnet',
      expectedType: 'protocol.error.ack',
    }).payload.ackSequence,
    1,
  );
});

test('remote protocol error blocks async continuation sends', async () => {
  const transport = new FakeTransport();
  const firstMessage = createDeferred();
  const events: string[] = [];
  let continuationActive: boolean | undefined;
  let continuationSendError: unknown;
  let session!: ProtocolSession;

  session = createSession(transport, {
    onMessage: async (message) => {
      if (message.type === 'protocol.error') {
        events.push('terminal');
        session.sendAck(message, 'protocol.error.ack', {
          code: message.payload.code,
          ackSequence: message.sequence,
        });
        return;
      }

      events.push('app-start');
      await firstMessage.promise;
      continuationActive = session.isActive();
      try {
        session.send('sign.response', { signature: 'signature-1' });
      } catch (error) {
        continuationSendError = error;
      }
      events.push('app-finish');
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'sign.address',
      payload: { address: '0x1' },
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['app-start']);

  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 2,
      type: 'protocol.error',
      payload: {
        code: 'transaction_failed',
        message: 'remote terminal',
      },
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, ['app-start', 'terminal']);

  firstMessage.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(events, ['app-start', 'terminal', 'app-finish']);
  assert.equal(continuationActive, false);
  assert.ok(continuationSendError instanceof ProtocolSessionClosedError);
  assert.equal(continuationSendError.reason, 'protocol_error');
  assert.equal(transport.sent.length, 1);
  assert.equal(
    parseProtocolMessage(transport.sent[0], {
      expectedSessionId: 'session-1',
      expectedNetwork: 'testnet',
      expectedType: 'protocol.error.ack',
    }).payload.ackSequence,
    2,
  );
});

test('remote close rejects pending ack and prevents continuation sends', async () => {
  const transport = new FakeTransport();
  const session = createSession(transport);

  const waitForAck = session.sendAndWaitForAck({
    type: 'sign.finalized',
    payload: {
      digest: 'digest-1',
      effects: 'effects-1',
    },
    expectedAckType: 'sign.finalized.ack',
    timeoutMs: 1000,
  });

  transport.emitClose();

  await assert.rejects(waitForAck, (error) => {
    assert.ok(error instanceof ProtocolSessionClosedError);
    assert.equal(error.reason, 'remote_closed');
    return true;
  });
  assert.equal(session.isActive(), false);
  assert.throws(
    () =>
      session.send('sign.submitted', {
        digest: 'digest-2',
      }),
    ProtocolSessionClosedError,
  );
});

test('ack timeout closes the session deterministically', async () => {
  const transport = new FakeTransport();
  const session = createSession(transport);

  await assert.rejects(
    session.sendAndWaitForAck({
      type: 'sign.submitted',
      payload: { digest: 'digest-1' },
      expectedAckType: 'sign.submitted.ack',
      timeoutMs: 1,
    }),
    (error) => {
      assert.ok(error instanceof ProtocolSessionClosedError);
      assert.equal(error.reason, 'ack_timeout');
      return true;
    },
  );

  assert.equal(session.terminalReason, 'ack_timeout');
  assert.equal(session.isActive(), false);
  assert.equal(transport.closed, true);
  assert.equal(transport.closeReason, 'ack_timeout');
});

test('terminal state removes transport listeners', async () => {
  const transport = new FakeTransport();
  const errors: Error[] = [];
  const session = createSession(transport, {
    onError: (error) => {
      errors.push(error);
    },
  });

  assert.equal(transport.handlerCount(), 3);
  session.close('success');
  assert.equal(transport.handlerCount(), 0);

  transport.emitError(new Error('late transport error'));
  transport.emitMessage(
    createProtocolMessage({
      sessionId: 'session-1',
      network: 'testnet',
      sequence: 1,
      type: 'sign.address',
      payload: { address: '0x1' },
    }),
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(errors.length, 0);
});
