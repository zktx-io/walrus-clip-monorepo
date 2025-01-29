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

import { QRScan } from './components/QRScan';
import { createProof } from './utils/createProof';
import {
  getAccountData,
  getZkLoginData,
  setAccountData,
} from './utils/localStorage';
import { signAndExecuteSponsoredTransaction } from './utils/sponsoredTransaction';
import { NETWORK, NotiVariant } from './utils/types';
import { cleanup, WalletStandard } from './utils/walletStandard';

interface IKinokoWalletContext {
  updateJwt: (jwt: string) => Promise<void>;
  isLoggedIn: () => boolean;
  isScannerEnabled: boolean;
  scan: () => Promise<
    | undefined
    | {
        digest: string;
        effects: string;
      }
  >;
  pay: (
    title: string,
    description: string,
    data: { transaction: Transaction; isSponsored?: boolean },
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
  sponsored,
  zklogin,
  onEvent,
  children,
}: {
  name: string;
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
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
      } else {
        throw new Error('Nonce not found');
      }
    },
    [zklogin],
  );

  const isLoggedIn = useCallback((): boolean => {
    const data = getAccountData();
    return !!data;
  }, []);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const kinoko = new WalletStandard(
        name,
        icon,
        network,
        sponsored || '',
        onEvent,
        {
          epochOffset: zklogin?.epochOffset,
          callbackNonce: zklogin?.callbackNonce,
        },
      );
      setWallet(kinoko);
      registerWallet(kinoko);
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
    <KinokoWalletContext.Provider
      value={{
        updateJwt,
        isLoggedIn,
        isScannerEnabled,
        scan: async () => {
          return new Promise((resolve, reject) => {
            const account = getAccountData();
            if (account && !!account.zkLogin && wallet) {
              const container = document.createElement('div');
              document.body.appendChild(container);
              const root = ReactDOM.createRoot(container);
              root.render(
                <QRScan
                  wallet={wallet}
                  network={network}
                  address={account.address}
                  zkLogin={account.zkLogin}
                  onEvent={onEvent}
                  onClose={(result) => {
                    cleanup(container, root);
                    if (result) {
                      resolve(result);
                    }
                    resolve(undefined);
                  }}
                />,
              );
            } else {
              reject(new Error('Account not found'));
            }
          });
        },
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
