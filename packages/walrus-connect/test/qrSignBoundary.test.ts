import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { routeQRSignHostBoundaryFailure } = await jiti.import<{
  routeQRSignHostBoundaryFailure: typeof import('../src/protocol/qrSignHostBoundary.ts').routeQRSignHostBoundaryFailure;
}>('../src/protocol/qrSignHostBoundary.ts');

test('QR sign host boundary routes failures to runner after runner starts', () => {
  const calls: string[] = [];

  const route = routeQRSignHostBoundaryFailure({
    runnerCancel: (reason) => calls.push(`cancel:${reason}`),
    failBeforeRunner: (reason) => calls.push(`fail:${reason}`),
    reason: 'Peer error',
  });

  assert.equal(route, 'runner_cancelled');
  assert.deepEqual(calls, ['cancel:Peer error']);
});

test('QR sign host boundary only creates failed_before_submit before runner starts', () => {
  const calls: string[] = [];

  const route = routeQRSignHostBoundaryFailure({
    failBeforeRunner: (reason) => calls.push(`fail:${reason}`),
    reason: 'Peer init error',
  });

  assert.equal(route, 'failed_before_runner');
  assert.deepEqual(calls, ['fail:Peer init error']);
});
