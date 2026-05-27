import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { createRoot } from 'react-dom/client';

import { QRScan } from './QRScan';
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import { cleanupQrModalRoot } from '../utils/cleanup';
import { getCameraUnavailableMessage, settleNoCameraScan } from '../utils/scan';

interface IWalrusSignerScanContext {
  scan: (signer: ClipSigner) => Promise<void>;
}

const WalrusSignerScanContext = createContext<
  IWalrusSignerScanContext | undefined
>(undefined);

export const WalrusSignerScan = ({
  mode,
  network,
  iceConfigUrl,
  onEvent,
  children,
}: {
  mode?: 'dark' | 'light';
  icon: string;
  network: NETWORK;
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  children: ReactNode;
}) => {
  const [isScannerEnabled, setIsScannerEnabled] = useState<boolean>(false);
  const [cameraUnavailableMessage, setCameraUnavailableMessage] =
    useState<string>('Checking camera availability...');

  const scan = useCallback(
    (signer: ClipSigner): Promise<void> => {
      return new Promise((resolve) => {
        if (isScannerEnabled) {
          const container = document.createElement('div');
          document.body.appendChild(container);
          const root = createRoot(container);
          root.render(
            <QRScan
              open
              mode={mode || 'light'}
              signer={signer}
              network={network}
              iceConfigUrl={iceConfigUrl}
              onEvent={onEvent}
              onClose={() => {
                cleanupQrModalRoot(container, root);
                resolve();
              }}
            />,
          );
        } else {
          settleNoCameraScan({
            onEvent,
            resolve,
            message: cameraUnavailableMessage,
          });
        }
      });
    },
    [
      cameraUnavailableMessage,
      iceConfigUrl,
      isScannerEnabled,
      mode,
      network,
      onEvent,
    ],
  );

  useEffect(() => {
    const testCamera = async () => {
      const unavailableMessage = await getCameraUnavailableMessage();
      if (unavailableMessage === undefined) {
        setIsScannerEnabled(true);
        setCameraUnavailableMessage('No camera found on this device.');
        return;
      }
      setIsScannerEnabled(false);
      setCameraUnavailableMessage(unavailableMessage);
    };
    testCamera();
  }, []);

  return (
    <WalrusSignerScanContext.Provider value={{ scan }}>
      {children}
    </WalrusSignerScanContext.Provider>
  );
};

export const useWalrusSignerScan = () => {
  const context = useContext(WalrusSignerScanContext);
  if (!context) {
    throw new Error(
      'useWalrusSignerScan must be used within a WalrusSignerScan provider',
    );
  }
  return context;
};
