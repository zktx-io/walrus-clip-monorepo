import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { connectWithRelayFallback, hasTurnServer } = await jiti.import<{
  connectWithRelayFallback: typeof import('../../walrus-connect-route-internal/src/webrtc/connection.ts').connectWithRelayFallback;
  hasTurnServer: typeof import('../../walrus-connect-route-internal/src/webrtc/connection.ts').hasTurnServer;
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

  emit(event: string, ...args: unknown[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }
}

const createOpeningPeerFactory = (peers: FakePeer[]) => async () => {
  const peer = peers.shift();
  assert.ok(peer);
  setTimeout(() => peer.emit('open', 'fake-peer-id'), 0);
  return peer as never;
};

const waitFor = async (predicate: () => boolean, label: string) => {
  for (let index = 0; index < 50; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

test('relay fallback is skipped when no TURN server is configured', async () => {
  const peers = [new FakePeer()];
  const events: string[] = [];
  const failures: string[] = [];

  const handle = connectWithRelayFallback({
    destIdHyphen: 'sui-testnet-session-sign',
    iceConfigUrl: 'https://relay.example.com',
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
      loadIceConfig: async () => ({
        iceServers: [{ urls: 'stun:relay.example.com:19302' }],
        iceTransportPolicy: 'all',
      }),
      createPeerWithIce: createOpeningPeerFactory(peers),
    },
  });

  await waitFor(() => failures.length === 1, 'no TURN failure callback');

  assert.equal(
    failures[0],
    'Direct P2P failed and no TURN relay is configured.',
  );
  assert.deepEqual(events, [
    'Direct P2P failed and no TURN relay is configured.',
  ]);
  assert.equal(peers.length, 0);
  handle.cleanup();
});

test('relay fallback reports terminal open failure to caller when TURN is configured', async () => {
  const peers = [new FakePeer(), new FakePeer()];
  const events: string[] = [];
  const failures: string[] = [];

  const handle = connectWithRelayFallback({
    destIdHyphen: 'sui-testnet-session-sign',
    iceConfigUrl: 'https://relay.example.com',
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
      loadIceConfig: async () => ({
        iceServers: [{ urls: 'turn:relay.example.com:3478' }],
        iceTransportPolicy: 'all',
      }),
      createPeerWithIce: createOpeningPeerFactory(peers),
    },
  });

  await waitFor(() => failures.length === 1, 'relay failure callback');

  assert.equal(failures[0], 'Relay connection timed out.');
  assert.ok(events.includes('Direct P2P failed. Retrying via TURN relay…'));
  assert.ok(events.includes('Relay connection timed out.'));
  handle.cleanup();
});

test('hasTurnServer recognizes TURN and TURNS URLs only', () => {
  assert.equal(
    hasTurnServer({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    }),
    false,
  );
  assert.equal(
    hasTurnServer({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'turn:relay'] }],
    }),
    true,
  );
  assert.equal(
    hasTurnServer({
      iceServers: [{ urls: 'turns:relay.example.com:5349' }],
    }),
    true,
  );
});

test('default ICE config includes a test public TURN relay fallback', async () => {
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
      createPeerWithIce: createOpeningPeerFactory(peers),
    },
  });

  await waitFor(() => failures.length === 1, 'default TURN failure callback');

  assert.equal(failures[0], 'Relay connection timed out.');
  assert.ok(events.includes('Direct P2P failed. Retrying via TURN relay…'));
  assert.ok(events.includes('Relay connection timed out.'));
  assert.equal(peers.length, 0);
  handle.cleanup();
});
