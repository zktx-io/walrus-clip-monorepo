import type { ReactNode } from 'react';

import {
  WalrusSignerScan as InternalWalrusSignerScan,
  useWalrusSignerScan as useInternalWalrusSignerScan,
} from '../../../walrus-connect-route-internal/src/components/WalrusSignerScan';
import type { ClipSigner, NETWORK, NotiVariant } from '../types';

export type WalrusSignerScanProps = {
  mode?: 'dark' | 'light';
  icon: string;
  network: NETWORK;
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  children: ReactNode;
};

export type WalrusSignerScanContext = {
  scan: (signer: ClipSigner) => Promise<void>;
};

export const WalrusSignerScan = (props: WalrusSignerScanProps) => (
  <InternalWalrusSignerScan {...props} />
);

export const useWalrusSignerScan = (): WalrusSignerScanContext => {
  const { scan } = useInternalWalrusSignerScan();
  return {
    scan: scan as (signer: ClipSigner) => Promise<void>,
  };
};
