import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

import ReactDOM from 'react-dom/client';

import { QRScan } from '../components/QRScan';
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import { QRSign } from './QRSign';
import { cleanup } from '../utils/cleanup';

interface IWalrusScanContext {
  scan: (signer: ClipSigner) => Promise<void>;
  openSignTxModal: (
    title: string,
    description: string,
    data: {
      transaction: {
        toJSON: () => Promise<string>;
      };
      sponsoredUrl?: string;
    },
  ) => Promise<{
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }>;
}

const WalrusScanContext = createContext<IWalrusScanContext | undefined>(
  undefined,
);

export const WalrusScan = ({
  mode,
  icon,
  network,
  onEvent,
  children,
}: {
  mode?: 'dark' | 'light';
  icon: string;
  network: NETWORK;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  children: React.ReactNode;
}) => {
  const [isScannerEnabled, setIsScannerEnabled] = useState<boolean>(false);

  const scan = useCallback(
    (signer: ClipSigner): Promise<void> => {
      return new Promise((resolve) => {
        if (isScannerEnabled) {
          const container = document.createElement('div');
          document.body.appendChild(container);
          const root = ReactDOM.createRoot(container);
          root.render(
            <QRScan
              open
              mode={mode || 'light'}
              signer={signer}
              network={network}
              onEvent={onEvent}
              onClose={() => {
                cleanup(container, root);
                resolve();
              }}
            />,
          );
        } else {
          onEvent({
            variant: 'warning',
            message: 'No camera found on this device.',
          });
        }
      });
    },
    [isScannerEnabled, mode, network, onEvent],
  );

  const openSignTxModal = useCallback(
    (
      title: string,
      description: string,
      data: {
        transaction: {
          toJSON: () => Promise<string>;
        };
        sponsoredUrl?: string;
      },
    ): Promise<{
      bytes: string;
      signature: string;
      digest: string;
      effects: string;
    }> => {
      return new Promise((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);
        root.render(
          <QRSign
            mode={mode || 'light'}
            data={{
              network: network,
              transaction: data.transaction,
              sponsoredUrl: data.sponsoredUrl,
            }}
            icon={icon}
            option={{
              title,
              description,
            }}
            onEvent={onEvent}
            onClose={(result) => {
              cleanup(container, root);
              if (!!result) {
                resolve(result);
              }
            }}
          />,
        );
      });
    },
    [icon, mode, network, onEvent],
  );

  useEffect(() => {
    const testCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(
          (device) => device.kind === 'videoinput',
        );
        if (videoInputDevices.length > 0) {
          setIsScannerEnabled(true);
        } else {
          setIsScannerEnabled(false);
        }
      } catch (error) {
        setIsScannerEnabled(false);
      }
    };
    testCamera();
  }, []);

  return (
    <WalrusScanContext.Provider
      value={{
        scan,
        openSignTxModal,
      }}
    >
      {children}
    </WalrusScanContext.Provider>
  );
};

export const useWalrusScan = () => {
  const context = useContext(WalrusScanContext);
  if (!context) {
    throw new Error(
      'useWalrusScan must be used within a WalrusScanContext.Provider',
    );
  }
  return context;
};
