import { QRAddress as InternalQRAddress } from '../../../walrus-connect-route-internal/src/components/QRAddress';

export type QRAddressProps = {
  mode: 'dark' | 'light';
  address: string;
  icon: string;
  open: boolean;
  onClose: () => void;
};

export const QRAddress = (props: QRAddressProps) => (
  <InternalQRAddress {...props} />
);
