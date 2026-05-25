import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPeerId, parsePeerId } from '../src/webrtc/qr-id.ts';

test('builds and parses peer ids with session, network, and type', () => {
  const raw = buildPeerId({
    network: 'testnet',
    sessionId: 'session-1',
    type: 'sign',
  });

  assert.equal(raw, 'sui::testnet::session-1::sign');
  assert.deepEqual(parsePeerId(raw), {
    network: 'testnet',
    sessionId: 'session-1',
    type: 'sign',
    iceConfigUrl: undefined,
  });
});

test('round trips an embedded ICE config URL', () => {
  const raw = buildPeerId({
    network: 'mainnet',
    sessionId: 'session-1',
    type: 'login',
    iceConfigUrl: 'https://relay.example.com/ice?token=a+b/c',
  });

  assert.deepEqual(parsePeerId(raw), {
    network: 'mainnet',
    sessionId: 'session-1',
    type: 'login',
    iceConfigUrl: 'https://relay.example.com/ice?token=a+b/c',
  });
});

test('rejects invalid peer id fields', () => {
  assert.equal(parsePeerId('sui::localnet::session-1::sign'), undefined);
  assert.equal(parsePeerId('sui::testnet::::sign'), undefined);
  assert.equal(parsePeerId('sui::testnet::session-1::pay'), undefined);
  assert.equal(parsePeerId('sui::testnet::session-1::sign::'), undefined);
  assert.equal(parsePeerId('sui::testnet::session-1::sign::@@@'), undefined);
});
