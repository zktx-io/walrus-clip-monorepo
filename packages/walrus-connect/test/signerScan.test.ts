import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const { settleNoCameraScan } = await jiti.import<
  typeof import('../../walrus-connect-route-internal/src/utils/scan.ts')
>('../../walrus-connect-route-internal/src/utils/scan.ts');

test('no-camera scan path warns and settles', () => {
  const events: Array<{ variant: string; message: string }> = [];
  let settled = false;

  settleNoCameraScan({
    onEvent: (event) => events.push(event),
    resolve: () => {
      settled = true;
    },
  });

  assert.equal(settled, true);
  assert.deepEqual(events, [
    {
      variant: 'warning',
      message: 'No camera found on this device.',
    },
  ]);
});
