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
import { RecoilRoot } from 'recoil';

import { ActionDrawer } from './components/ActionDrawer';
import { useWalletState } from './recoil';
import { createProof } from './utils/createProof';
import {
  getAccountData,
  getZkLoginData,
  setAccountData,
} from './utils/localStorage';
import { signAndExecuteSponsoredTransaction } from './utils/sponsoredTransaction';
import { NETWORK, NotiVariant } from './utils/types';
import { WalletStandard } from './utils/walletStandard';

interface IWalrusWalletContext {
  updateJwt: (jwt: string) => Promise<void>;
  isConnected: boolean;
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

interface IWalrusWalletProps {
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
}

const WalrusWalletContext = createContext<IWalrusWalletContext | undefined>(
  undefined,
);

const WalrusWalletRoot = ({
  name,
  icon,
  network,
  mode,
  sponsored,
  zklogin,
  onEvent,
  children,
}: IWalrusWalletProps) => {
  const initialized = useRef<boolean>(false);
  const { wallet, setWallet, setMode } = useWalletState();
  const [isConnected, setIsConnected] = React.useState<boolean>(false);

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
      } else {
        throw new Error('Nonce not found');
      }
    },
    [zklogin],
  );

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const walletStandard = new WalletStandard(
        name,
        icon,
        network,
        sponsored || '',
        mode || 'light',
        onEvent,
        setIsConnected,
        {
          epochOffset: zklogin?.epochOffset,
          callbackNonce: zklogin?.callbackNonce,
        },
      );
      setWallet(walletStandard);
      setMode(mode || 'light');
      registerWallet(walletStandard);

      const account = getAccountData();
      setIsConnected(!!account);
    }
  }, [
    name,
    icon,
    network,
    mode,
    sponsored,
    zklogin,
    onEvent,
    setWallet,
    setMode,
  ]);

  return (
    <WalrusWalletContext.Provider
      value={{
        updateJwt,
        isConnected,
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
        isConnected={isConnected}
        icon={icon}
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

export const WalrusWallet = ({ children, ...others }: IWalrusWalletProps) => {
  return (
    <RecoilRoot>
      <WalrusWalletRoot {...others}>{children}</WalrusWalletRoot>
    </RecoilRoot>
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
