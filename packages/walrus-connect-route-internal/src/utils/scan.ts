import type { NotiVariant } from '../types';

export type WalrusScanEvent = {
  variant: NotiVariant;
  message: string;
};

export const settleNoCameraScan = ({
  onEvent,
  resolve,
}: {
  onEvent: (data: WalrusScanEvent) => void;
  resolve: () => void;
}) => {
  onEvent({
    variant: 'warning',
    message: 'No camera found on this device.',
  });
  resolve();
};
