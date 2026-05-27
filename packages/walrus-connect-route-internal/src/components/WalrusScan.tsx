import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import { createRoot } from 'react-dom/client';

import { QRScan } from '../components/QRScan';
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import type { QRSignOutcome } from '../protocol/signHostRunner';
import { QRSign } from './QRSign';
import { cleanupQrModalRoot } from '../utils/cleanup';
import { settleNoCameraScan } from '../utils/scan';

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
  ) => Promise<QRSignOutcome>;
}

const WalrusScanContext = createContext<IWalrusScanContext | undefined>(
  undefined,
);

export const WalrusScan = ({
  mode,
  icon,
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
          settleNoCameraScan({ onEvent, resolve });
        }
      });
    },
    [iceConfigUrl, isScannerEnabled, mode, network, onEvent],
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
    ): Promise<QRSignOutcome> => {
      return new Promise((resolve) => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
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
              iceConfigUrl,
            }}
            onEvent={onEvent}
            onClose={(outcome) => {
              cleanupQrModalRoot(container, root);
              resolve(outcome);
            }}
          />,
        );
      });
    },
    [icon, iceConfigUrl, mode, network, onEvent],
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
      } catch {
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

export const useWalrusSignerScan = () => {
  const { scan } = useWalrusScan();
  return { scan };
};
