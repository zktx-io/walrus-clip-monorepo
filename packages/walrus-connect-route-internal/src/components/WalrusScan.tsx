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
import { getCameraUnavailableMessage, settleNoCameraScan } from '../utils/scan';

interface IWalrusScanContext {
  scan: (signer: ClipSigner) => Promise<void>;
  openSignTxModal: (
    title: string,
    description: string,
    data:
      | {
          type: 'transaction';
          intent: 'sign' | 'signAndExecute';
          transaction: {
            toJSON: () => Promise<string>;
          };
        }
      | {
          type: 'personalMessage';
          message: Uint8Array;
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

  const openSignTxModal = useCallback(
    (
      title: string,
      description: string,
      data:
        | {
            type: 'transaction';
            intent: 'sign' | 'signAndExecute';
            transaction: {
              toJSON: () => Promise<string>;
            };
          }
        | {
            type: 'personalMessage';
            message: Uint8Array;
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
              request: data,
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
