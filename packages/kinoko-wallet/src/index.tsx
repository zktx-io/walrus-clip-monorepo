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

import { QrRead } from './components/qrRead';
import { QrShow } from './components/qrShow';
import { createProof } from './utils/createProof';
import {
  getAccountData,
  getNonceData,
  setAccountData,
} from './utils/localStorage';
import { signAndExecuteSponsoredTransaction } from './utils/sponsoredTransaction';
import { NETWORK, NotiVariant } from './utils/types';
import { TIME_OUT, WalletStandard } from './utils/walletStandard';

interface IKinokoWalletContext {
  login: (jwt: string) => Promise<void>;
  isLoggedIn: () => boolean;
  isScannerEnabled: boolean;
  deposit: (
    title: string,
    description: string,
    transaction: Transaction,
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
    isSponsored?: boolean,
  ) => Promise<string>;
  withdraw: (
    title: string,
    description: string,
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
  ) => Promise<string>;
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

const KinokoWalletContext = createContext<IKinokoWalletContext | undefined>(
  undefined,
);

export const KinokoWallet = ({
  name,
  icon,
  network,
  enokey,
  sponsored,
  epochOffset,
  zkLogin,
  children,
}: {
  name: string;
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  enokey: string;
  sponsored?: string;
  epochOffset?: number;
  zkLogin: (nonce: string) => void;
  children: React.ReactNode;
}) => {
  const initialized = useRef<boolean>(false);
  const [isScannerEnabled, setIsScannerEnabled] =
    React.useState<boolean>(false);

  const login = useCallback(
    async (jwt: string): Promise<void> => {
      const nonce = getNonceData();
      if (nonce) {
        const decodedJwt = decodeJwt(jwt) as { sub?: string; aud?: string };
        const { address, proof, salt } = await createProof(enokey, nonce, jwt);
        const addressSeed = genAddressSeed(
          BigInt(salt),
          'sub',
          decodedJwt.sub!,
          decodedJwt.aud as string,
        ).toString();
        setAccountData({
          nonce,
          zkAddress: { address, addressSeed, proof, jwt },
        });
      } else {
        throw new Error('Nonce not found');
      }
    },
    [enokey],
  );

  const isLoggedIn = useCallback((): boolean => {
    const data = getAccountData();
    return !!data;
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      registerWallet(
        new WalletStandard(zkLogin, name, icon, network, epochOffset),
      );
    }
  }, [name, icon, network, enokey, epochOffset, zkLogin, sponsored]);

  useEffect(() => {
    const test = async () => {
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
    test();
  }, []);

  return (
    <KinokoWalletContext.Provider
      value={{
        login,
        isLoggedIn,
        isScannerEnabled,
        deposit: (title, description, transaction, onEvent, isSponsored) => {
          return new Promise((resolve, reject) => {
            const container = document.createElement('div');
            document.body.appendChild(container);
            const root = ReactDOM.createRoot(container);
            root.render(
              <QrShow
                option={{
                  title,
                  description,
                  transaction,
                }}
                network={network}
                sponsored={isSponsored ? sponsored : undefined}
                icon={icon}
                onEvent={onEvent}
                onClose={(error, message) => {
                  setTimeout(() => {
                    root.unmount();
                    document.body.removeChild(container);
                  }, TIME_OUT);
                  if (error) {
                    reject(new Error(message));
                  } else {
                    resolve(message);
                  }
                }}
              />,
            );
          });
        },
        withdraw: (title, description, onEvent) => {
          const account = getAccountData();
          if (account) {
            return new Promise((resolve, reject) => {
              const container = document.createElement('div');
              document.body.appendChild(container);
              const root = ReactDOM.createRoot(container);
              root.render(
                <QrRead
                  option={{
                    title,
                    description,
                  }}
                  account={account}
                  onEvent={onEvent}
                  onClose={(error, message) => {
                    setTimeout(() => {
                      root.unmount();
                      document.body.removeChild(container);
                    }, TIME_OUT);
                    if (error) {
                      reject(new Error(message));
                    } else {
                      resolve(message);
                    }
                  }}
                />,
              );
            });
          }
          throw new Error('Account not found');
        },
        signAndExecuteSponsoredTransaction: sponsored
          ? (input) => signAndExecuteSponsoredTransaction(sponsored, input)
          : () => {
              throw new Error('Sponsored transaction not configured');
            },
      }}
    >
      {children}
    </KinokoWalletContext.Provider>
  );
};

export const useKinokoWallet = () => {
  const context = useContext(KinokoWalletContext);
  if (!context) {
    throw new Error(
      'useKinokoWallet hook can only be used inside a KinokoWallet provider.',
    );
  }
  return context;
};
