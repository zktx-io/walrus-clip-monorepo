import { QRAddressScan as InternalQRAddressScan } from '../../../walrus-connect-route-internal/src/components/QRAddressScan';

export type QRAddressScanProps = {
  mode: 'dark' | 'light';
  onClose: (address: string) => void;
};

export const QRAddressScan = (props: QRAddressScanProps) => (
  <InternalQRAddressScan {...props} />
);
