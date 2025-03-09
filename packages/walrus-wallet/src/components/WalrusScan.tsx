import React, { createContext, useCallback, useContext } from 'react';

import { Signer } from '@mysten/sui/cryptography';
import ReactDOM from 'react-dom/client';

import { QRScan } from './QRScan';
import { useWalletState } from '../recoil';
import { NETWORK, NotiVariant } from '../utils/types';
import { cleanup } from '../utils/zkLoginSigner';

interface IWalrusScanContext {
  scan: (signer: Signer) => Promise<void>;
}

const WalrusScanContext = createContext<IWalrusScanContext | undefined>(
  undefined,
);

export const WalrusScan = ({
  network,
  onEvent,
  children,
}: {
  network: NETWORK;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  children: React.ReactNode;
}) => {
  const { mode } = useWalletState();

  const scan = useCallback(
    (signer: Signer): Promise<void> => {
      return new Promise((resolve) => {
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
      });
    },
    [mode, network, onEvent],
  );
  return (
    <WalrusScanContext.Provider
      value={{
        scan,
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
