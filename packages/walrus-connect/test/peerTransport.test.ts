import assert from 'node:assert/strict';
import test from 'node:test';

import { createPeerDataConnectionTransport } from '../src/protocol/peerTransport.ts';

class FakePeerConnection {
  open = true;
  sent: string[] = [];
  handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  send(raw: string) {
    this.sent.push(raw);
  }

  close() {
    this.open = false;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }

  off(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.get(event)?.delete(handler);
  }

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }
}

test('peer transport disposers remove registered handlers', () => {
  const connection = new FakePeerConnection();
  const transport = createPeerDataConnectionTransport(connection as never);
  const received: unknown[] = [];
  const closed: string[] = [];
  const errors: string[] = [];

  const disposeMessage = transport.onMessage((raw) => {
    received.push(raw);
  });
  const disposeClose = transport.onClose(() => {
    closed.push('closed');
  });
  const disposeError = transport.onError((error) => {
    errors.push(error.message);
  });

  connection.emit('data', 'first');
  connection.emit('close');
  connection.emit('error', new Error('first error'));

  disposeMessage();
  disposeClose();
  disposeError();

  connection.emit('data', 'second');
  connection.emit('close');
  connection.emit('error', new Error('second error'));

  assert.deepEqual(received, ['first']);
  assert.deepEqual(closed, ['closed']);
  assert.deepEqual(errors, ['first error']);
});
