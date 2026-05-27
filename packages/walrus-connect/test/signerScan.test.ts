import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);
const {
  REAR_CAMERA_CONSTRAINTS,
  formatCameraErrorMessage,
  getFallbackCameraConstraints,
  getCameraUnavailableMessage,
  isCameraFallbackEligibleError,
  settleNoCameraScan,
} = await jiti.import<
  typeof import('../../walrus-connect-route-internal/src/utils/scan.ts')
>('../../walrus-connect-route-internal/src/utils/scan.ts');

test('no-camera scan path reports an error and settles', () => {
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
      variant: 'error',
      message: 'No camera found on this device.',
    },
  ]);
});

test('camera availability check reports unsupported browsers and denied permission', async () => {
  assert.equal(
    await getCameraUnavailableMessage(undefined),
    'Camera access is not supported in this browser.',
  );
  assert.equal(
    await getCameraUnavailableMessage({
      enumerateDevices: async () => [{ kind: 'audioinput' }],
    }),
    'No camera found on this device.',
  );
  assert.equal(
    await getCameraUnavailableMessage({
      enumerateDevices: async () => [{ kind: 'videoinput' }],
    }),
    undefined,
  );
  assert.equal(
    await getCameraUnavailableMessage({
      enumerateDevices: async () => {
        const error = new Error('Not allowed');
        error.name = 'NotAllowedError';
        throw error;
      },
    }),
    'Camera permission was denied.',
  );
});

test('camera error formatter keeps useful permission and device messages', () => {
  assert.equal(
    formatCameraErrorMessage({ name: 'NotAllowedError' }),
    'Camera permission was denied.',
  );
  assert.equal(
    formatCameraErrorMessage({ name: 'NotReadableError' }),
    'Camera is already in use or unavailable.',
  );
  assert.equal(
    formatCameraErrorMessage({ message: 'Custom camera failure' }),
    'Custom camera failure',
  );
  assert.equal(
    formatCameraErrorMessage({
      error: { name: 'NotAllowedError', message: 'Permission denied' },
    }),
    'Camera permission was denied.',
  );
  assert.equal(
    formatCameraErrorMessage({ code: 'camera_failed', detail: 'unknown' }),
    '{"code":"camera_failed","detail":"unknown"}',
  );
});

test('scanner camera constraints prefer rear camera first', () => {
  assert.deepEqual(REAR_CAMERA_CONSTRAINTS, {
    facingMode: { exact: 'environment' },
  });
});

test('scanner fallback chooses another video input when rear camera is unavailable', async () => {
  assert.deepEqual(
    await getFallbackCameraConstraints({
      enumerateDevices: async () => [
        { kind: 'audioinput', deviceId: 'microphone' },
        { kind: 'videoinput', deviceId: 'rear-camera', label: 'Back Camera' },
        { kind: 'videoinput', deviceId: 'front-camera', label: 'Front Camera' },
      ],
    }),
    { deviceId: { exact: 'front-camera' } },
  );
  assert.deepEqual(
    await getFallbackCameraConstraints({
      enumerateDevices: async () => [
        { kind: 'videoinput', deviceId: 'default-camera' },
      ],
    }),
    { deviceId: { exact: 'default-camera' } },
  );
});

test('scanner fallback returns loose constraints when device ids are hidden', async () => {
  assert.deepEqual(
    await getFallbackCameraConstraints({
      enumerateDevices: async () => [{ kind: 'videoinput' }],
    }),
    { facingMode: { ideal: 'environment' } },
  );
  assert.equal(
    await getFallbackCameraConstraints({
      enumerateDevices: async () => [{ kind: 'audioinput' }],
    }),
    undefined,
  );
  assert.equal(
    await getFallbackCameraConstraints({
      enumerateDevices: async () => {
        throw new Error('permission state unavailable');
      },
    }),
    undefined,
  );
});

test('scanner fallback only handles camera selection and availability errors', () => {
  assert.equal(
    isCameraFallbackEligibleError({ name: 'OverconstrainedError' }),
    true,
  );
  assert.equal(isCameraFallbackEligibleError({ name: 'NotFoundError' }), true);
  assert.equal(
    isCameraFallbackEligibleError({ name: 'NotReadableError' }),
    true,
  );
  assert.equal(
    isCameraFallbackEligibleError({ name: 'NotAllowedError' }),
    false,
  );
  assert.equal(isCameraFallbackEligibleError('NotFoundError'), false);
});
