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

import { QRLoginScan } from './components/QRLoginScan';
import { QRPayCode } from './components/QRPayCode';
import { QRPayScan } from './components/QRPayScan';
import { createProof } from './utils/createProof';
import {
  getAccountData,
  getZkLoginData,
  setAccountData,
} from './utils/localStorage';
import { signAndExecuteSponsoredTransaction } from './utils/sponsoredTransaction';
import { NETWORK, NotiVariant } from './utils/types';
import { TIME_OUT, WalletStandard } from './utils/walletStandard';

interface IKinokoWalletContext {
  updateJwt: (jwt: string) => Promise<void>;
  isLoggedIn: () => boolean;
  isScannerEnabled: boolean;
  login: () => Promise<void>;
  pay: (
    title: string,
    description: string,
    data?: { transaction: Transaction; isSponsored?: boolean },
  ) => Promise<{ digest: string; effects: string }>;
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
  callbackNonce,
  onEvent,
  children,
}: {
  name: string;
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  enokey: string;
  sponsored?: string;
  epochOffset?: number;
  callbackNonce?: (nonce: string) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  children: React.ReactNode;
}) => {
  const initialized = useRef<boolean>(false);
  const [isScannerEnabled, setIsScannerEnabled] =
    React.useState<boolean>(false);

  const updateJwt = useCallback(
    async (jwt: string): Promise<void> => {
      const data = getZkLoginData();
      if (data) {
        const decodedJwt = decodeJwt(jwt) as {
          sub?: string;
          aud?: string;
          iss?: string;
        };
        const { address, proof, salt } = await createProof(
          enokey,
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
        new WalletStandard(
          name,
          icon,
          network,
          onEvent,
          callbackNonce,
          epochOffset,
        ),
      );
    }
  }, [
    name,
    icon,
    network,
    enokey,
    epochOffset,
    callbackNonce,
    sponsored,
    onEvent,
  ]);

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
        updateJwt,
        isLoggedIn,
        isScannerEnabled,
        login: async () => {
          const account = getAccountData();
          if (account && !!account.zkLogin) {
            return new Promise((resolve, reject) => {
              const container = document.createElement('div');
              document.body.appendChild(container);
              const root = ReactDOM.createRoot(container);
              root.render(
                <QRLoginScan
                  network={network}
                  address={account.address}
                  zkLogin={account.zkLogin!}
                  onEvent={onEvent}
                  onClose={(result) => {
                    setTimeout(() => {
                      root.unmount();
                      document.body.removeChild(container);
                    }, TIME_OUT);
                    if (result !== undefined) {
                      reject(new Error(result));
                    } else {
                      resolve(result);
                    }
                  }}
                />,
              );
            });
          }
        },
        pay: (title, description, data) => {
          if (data) {
            return new Promise((resolve, reject) => {
              const container = document.createElement('div');
              document.body.appendChild(container);
              const root = ReactDOM.createRoot(container);
              root.render(
                <QRPayCode
                  option={{
                    title,
                    description,
                    transaction: data.transaction,
                  }}
                  network={network}
                  sponsored={data.isSponsored ? sponsored : undefined}
                  icon={icon}
                  onEvent={onEvent}
                  onClose={(result) => {
                    setTimeout(() => {
                      root.unmount();
                      document.body.removeChild(container);
                    }, TIME_OUT);
                    if (typeof result === 'string') {
                      reject(new Error(result));
                    } else {
                      resolve(result);
                    }
                  }}
                />,
              );
            });
          } else {
            const account = getAccountData();
            if (account && !!account.zkLogin) {
              return new Promise((resolve, reject) => {
                const container = document.createElement('div');
                document.body.appendChild(container);
                const root = ReactDOM.createRoot(container);
                root.render(
                  <QRPayScan
                    option={{
                      title,
                      description,
                    }}
                    network={network}
                    address={account.address}
                    zkLogin={account.zkLogin!}
                    onEvent={onEvent}
                    onClose={(result) => {
                      setTimeout(() => {
                        root.unmount();
                        document.body.removeChild(container);
                      }, TIME_OUT);
                      if (typeof result === 'string') {
                        reject(new Error(result));
                      } else {
                        resolve(result);
                      }
                    }}
                  />,
                );
              });
            }
            throw new Error('Account not found');
          }
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
