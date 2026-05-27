import type { NotiVariant } from '../types';

export type WalrusScanEvent = {
  variant: NotiVariant;
  message: string;
};

type MediaDeviceInfoLike = {
  kind: string;
  deviceId?: string;
  label?: string;
};

type MediaDevicesLike = {
  enumerateDevices?: () => Promise<MediaDeviceInfoLike[]>;
};

const REAR_CAMERA_LABEL_PATTERN = /\b(back|rear|environment|world)\b/i;

export const REAR_CAMERA_CONSTRAINTS = {
  facingMode: { exact: 'environment' },
} satisfies MediaTrackConstraints;

export const FALLBACK_CAMERA_MESSAGE =
  'Rear camera unavailable. Trying another camera...';

export const isCameraFallbackEligibleError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const { name } = error as { name?: unknown };
  return (
    name === 'OverconstrainedError' ||
    name === 'NotFoundError' ||
    name === 'NotReadableError'
  );
};

export const getFallbackCameraConstraints = async (
  mediaDevices: MediaDevicesLike | undefined = globalThis.navigator
    ?.mediaDevices,
): Promise<MediaTrackConstraints | undefined> => {
  if (!mediaDevices?.enumerateDevices) return undefined;

  let devices: MediaDeviceInfoLike[];
  try {
    devices = await mediaDevices.enumerateDevices();
  } catch {
    return undefined;
  }
  const videoInputDevices = devices.filter(
    (device) => device.kind === 'videoinput',
  );

  if (videoInputDevices.length === 0) return undefined;

  const preferredFallback =
    videoInputDevices.find(
      (device) =>
        device.deviceId &&
        device.label &&
        !REAR_CAMERA_LABEL_PATTERN.test(device.label),
    ) ?? videoInputDevices.find((device) => Boolean(device.deviceId));

  if (preferredFallback?.deviceId) {
    return { deviceId: { exact: preferredFallback.deviceId } };
  }

  return { facingMode: { ideal: 'environment' } };
};

const stringifyCameraErrorObject = (
  value: Record<string, unknown>,
): string | undefined => {
  try {
    const json = JSON.stringify(value);
    return json && json !== '{}' ? json : undefined;
  } catch {
    return undefined;
  }
};

export const formatCameraErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const { name, message } = record;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return 'Camera permission was denied.';
    }
    if (name === 'NotFoundError' || name === 'OverconstrainedError') {
      return 'No camera found on this device.';
    }
    if (name === 'NotReadableError') {
      return 'Camera is already in use or unavailable.';
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    if (typeof name === 'string' && name.length > 0) {
      return name;
    }
    for (const nestedKey of ['error', 'cause'] as const) {
      if (record[nestedKey] && record[nestedKey] !== error) {
        return formatCameraErrorMessage(record[nestedKey]);
      }
    }
    const json = stringifyCameraErrorObject(record);
    if (json) return json;
  }

  if (typeof error === 'string' && error.length > 0) return error;
  return 'Camera access failed.';
};

export const getCameraUnavailableMessage = async (
  mediaDevices: MediaDevicesLike | undefined = globalThis.navigator
    ?.mediaDevices,
): Promise<string | undefined> => {
  if (!mediaDevices?.enumerateDevices) {
    return 'Camera access is not supported in this browser.';
  }

  try {
    const devices = await mediaDevices.enumerateDevices();
    const videoInputDevices = devices.filter(
      (device) => device.kind === 'videoinput',
    );
    return videoInputDevices.length > 0
      ? undefined
      : 'No camera found on this device.';
  } catch (error) {
    return formatCameraErrorMessage(error);
  }
};

export const settleNoCameraScan = ({
  onEvent,
  resolve,
  message = 'No camera found on this device.',
}: {
  onEvent: (data: WalrusScanEvent) => void;
  resolve: () => void;
  message?: string;
}) => {
  onEvent({
    variant: 'error',
    message,
  });
  resolve();
};
