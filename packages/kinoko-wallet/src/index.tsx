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

import { createProof } from './utils/createProof';
import {
  getAccountData,
  getNonceData,
  setAccountData,
} from './utils/localStorage';
import { signAndExecuteSponsoredTransaction } from './utils/sponsoredTransaction';
import { NETWORK } from './utils/types';
import { WalletStandard } from './utils/walletStandard';

interface IKinokoWalletContext {
  login: (jwt: string) => Promise<void>;
  isLoggedIn: () => boolean;
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
  sponsored?: {
    create: string;
    execute: string;
  };
  epochOffset?: number;
  zkLogin: (nonce: string) => void;
  children: React.ReactNode;
}) => {
  const initialized = useRef<boolean>(false);

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

  return (
    <KinokoWalletContext.Provider
      value={{
        login,
        isLoggedIn,
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
