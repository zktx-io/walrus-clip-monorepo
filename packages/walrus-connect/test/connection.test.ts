import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { connectWithRelayFallback } = await jiti.import<{
  connectWithRelayFallback: typeof import('../../walrus-connect-route-internal/src/webrtc/connection.ts').connectWithRelayFallback;
}>('../../walrus-connect-route-internal/src/webrtc/connection.ts');

class FakeConnection {
  open = false;
  closed = false;
  handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  send() {}

  close() {
    this.closed = true;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }
}

class FakePeer {
  destroyed = false;
  connections: FakeConnection[] = [];
  handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  connect() {
    const connection = new FakeConnection();
    this.connections.push(connection);
    return connection;
  }

  destroy() {
    this.destroyed = true;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    const handlers = this.handlers.get(event) ?? new Set();
    handlers.add(handler);
    this.handlers.set(event, handlers);
  }
}

const waitFor = async (predicate: () => boolean, label: string) => {
  for (let index = 0; index < 50; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

test('relay fallback reports terminal open failure to caller', async () => {
  const peers = [new FakePeer(), new FakePeer()];
  const events: string[] = [];
  const failures: string[] = [];

  const handle = connectWithRelayFallback({
    destIdHyphen: 'sui-testnet-session-sign',
    openTimeoutMs: 1,
    onEvent: ({ message }) => {
      events.push(message);
    },
    onOpen: () => {
      assert.fail('connection should not open');
    },
    onFailure: (message) => {
      failures.push(message);
    },
    deps: {
      createPeerWithIce: async () => {
        const peer = peers.shift();
        assert.ok(peer);
        return peer as never;
      },
    },
  });

  await waitFor(() => failures.length === 1, 'relay failure callback');

  assert.equal(failures[0], 'Relay connection timed out.');
  assert.ok(events.includes('Direct P2P failed. Retrying via TURN relay…'));
  assert.ok(events.includes('Relay connection timed out.'));
  handle.cleanup();
});
