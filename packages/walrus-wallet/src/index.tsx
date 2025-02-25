import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { Transaction } from '@mysten/sui/transactions';
import { genAddressSeed } from '@mysten/sui/zklogin';
import { IdentifierString, registerWallet } from '@mysten/wallet-standard';
import { decodeJwt } from 'jose';
import ReactDOM from 'react-dom/client';

import { ActionDrawer } from './components/ActionDrawer';
import { QRScan } from './components/QRScan';
import { createProof } from './utils/createProof';
import {
  getAccountData,
  getZkLoginData,
  setAccountData,
} from './utils/localStorage';
import { signAndExecuteSponsoredTransaction } from './utils/sponsoredTransaction';
import { NETWORK, NotiVariant } from './utils/types';
import { WalletStandard } from './utils/walletStandard';
import { cleanup } from './utils/zkLoginSigner';

interface IWalrusWalletContext {
  updateJwt: (jwt: string) => Promise<void>;
  isConnected: boolean;
  isScannerEnabled: boolean;
  scan: () => Promise<
    | undefined
    | {
        digest: string;
        effects: string;
      }[]
  >;
  pay: (
    title: string,
    description: string,
    data: { transactions: Transaction[]; isSponsored?: boolean },
  ) => Promise<{ digest: string; effects: string }[]>;
  signAndExecuteSponsoredTransaction: (input: {
    transaction: Transaction;
    chain: IdentifierString;
  }) => Promise<{
    digest: string;
    bytes: string;
    signature: string;
    effects: string;
  }>;
}

const WalrusWalletContext = createContext<IWalrusWalletContext | undefined>(
  undefined,
);

export const WalrusWallet = ({
  name,
  icon,
  network,
  mode,
  sponsored,
  zklogin,
  onEvent,
  children,
}: {
  name: string;
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  mode?: 'dark' | 'light';
  sponsored?: string;
  zklogin?: {
    enokey: string;
    callbackNonce: (nonce: string) => void;
    epochOffset?: number;
  };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  children: React.ReactNode;
}) => {
  const initialized = useRef<boolean>(false);
  const [isScannerEnabled, setIsScannerEnabled] =
    React.useState<boolean>(false);
  const [wallet, setWallet] = React.useState<WalletStandard | undefined>(
    undefined,
  );
  const [isConnected, setIsConnected] = React.useState<boolean>(false);
  const [isZkLogin, setIsZkLogin] = React.useState<boolean>(false);

  const updateJwt = useCallback(
    async (jwt: string): Promise<void> => {
      const data = getZkLoginData();
      if (data && zklogin) {
        const decodedJwt = decodeJwt(jwt) as {
          sub?: string;
          aud?: string;
          iss?: string;
        };
        const { address, proof, salt } = await createProof(
          zklogin.enokey,
          data.network,
          data.zkLogin,
          jwt,
        );
        const addressSeed = genAddressSeed(
          BigInt(salt),
          'sub',
          decodedJwt.sub!,
          decodedJwt.aud as string,
        ).toString();
        setAccountData({
          zkLogin: {
            expiration: data.zkLogin.expiration,
            randomness: data.zkLogin.randomness,
            keypair: data.zkLogin.keypair,
            proofInfo: {
              addressSeed,
              proof,
              jwt,
              iss: decodedJwt.iss!,
            },
          },
          network: data.network,
          address: address,
        });
        setIsConnected(true);
        setIsZkLogin(true);
      } else {
        throw new Error('Nonce not found');
      }
    },
    [zklogin],
  );

  const scan = useCallback((): Promise<
    { digest: string; effects: string }[] | undefined
  > => {
    return new Promise((resolve) => {
      const account = getAccountData();
      if (account && !!account.zkLogin && wallet) {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);
        root.render(
          <QRScan
            mode={mode}
            wallet={wallet}
            onEvent={onEvent}
            onClose={(result) => {
              cleanup(container, root);
              resolve(result || undefined);
            }}
          />,
        );
      } else {
        onEvent({ variant: 'error', message: 'Account not found' });
        resolve(undefined);
      }
    });
  }, [mode, onEvent, wallet]);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const walletStandard = new WalletStandard(
        name,
        icon,
        network,
        sponsored || '',
        onEvent,
        setIsConnected,
        {
          epochOffset: zklogin?.epochOffset,
          callbackNonce: zklogin?.callbackNonce,
        },
      );
      setWallet(walletStandard);
      registerWallet(walletStandard);

      const account = getAccountData();
      setIsConnected(!!account);
      setIsZkLogin(!!account?.zkLogin);
    }
  }, [name, icon, network, onEvent, zklogin, sponsored]);

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
    <WalrusWalletContext.Provider
      value={{
        updateJwt,
        isConnected,
        isScannerEnabled,
        scan,
        pay: (title, description, data) => {
          if (wallet) {
            return wallet.pay(title, description, data);
          }
          throw new Error('Wallet not initialized');
        },
        signAndExecuteSponsoredTransaction:
          sponsored && wallet
            ? (input) =>
                signAndExecuteSponsoredTransaction(wallet, sponsored, input)
            : () => {
                throw new Error('Sponsored transaction not configured');
              },
      }}
    >
      <ActionDrawer
        mode={mode}
        isConnected={isConnected}
        icon={icon}
        wallet={wallet}
        scan={isScannerEnabled && isZkLogin ? scan : undefined}
        onLogout={() => {
          if (wallet) {
            wallet.logout();
            setIsConnected(false);
            onEvent({ variant: 'success', message: 'Logged out' });
          }
        }}
        onEvent={onEvent}
      />
      {children}
    </WalrusWalletContext.Provider>
  );
};

export const useWalrusWallet = () => {
  const context = useContext(WalrusWalletContext);
  if (!context) {
    throw new Error(
      'useWalrusWallet hook can only be used inside a WalrusWallet provider.',
    );
  }
  return context;
};
