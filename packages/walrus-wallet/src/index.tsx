import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { useDisconnectWallet } from '@mysten/dapp-kit';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { genAddressSeed } from '@mysten/sui/zklogin';
import { registerWallet } from '@mysten/wallet-standard';
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
  NETWORK,
  NotiVariant,
  useWalrusScan,
  WalrusScan,
} from '@zktx.io/walrus-connect';
import { decodeJwt } from 'jose';
import { RecoilRoot } from 'recoil';

import { ActionDrawer } from './components/ActionDrawer';
import { useWalletState } from './recoil';
import { createProof } from './utils/createProof';
import { DEFAULT_ICON, DEFAULT_NAME } from './utils/default';
import {
  getAccountData,
  getZkLoginData,
  setAccountData,
} from './utils/localStorage';
import { WalletStandard } from './utils/walletStandard';

import '@zktx.io/walrus-connect/index.css';
import './index.css';

interface IWalrusWalletContext {
  updateJwt: (jwt: string) => Promise<boolean>;
  walrusWalletStatus: () => 'connected' | 'disconnected';
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
  signAndExecuteSponsoredTransaction: (input: {
    transaction: {
      toJSON: () => Promise<string>;
    };
    network: NETWORK;
  }) => Promise<{
    digest: string;
    bytes: string;
    signature: string;
    effects: string;
  }>;
}

interface IWalrusWalletProps {
  name?: string;
  icon?: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  mode?: 'dark' | 'light';
  sponsoredUrl?: string;
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
  sponsoredUrl,
  zklogin,
  onEvent,
  children,
}: IWalrusWalletProps) => {
  const initialized = useRef<boolean>(false);
  const inflightMapRef = useRef<Map<string, Promise<boolean>>>(new Map());
  const lastSuccessRef = useRef<{ jwt?: string; address?: string } | null>(
    // eslint-disable-next-line no-restricted-syntax
    null,
  );
  const { openSignTxModal } = useWalrusScan();
  const { mutate: dappKitDisconnect } = useDisconnectWallet();
  const { wallet, setWallet, setMode } = useWalletState();
  const [isConnected, setIsConnected] = React.useState<boolean>(false);

  const updateJwt = useCallback(
    async (jwt: string): Promise<boolean> => {
      if (!jwt || !zklogin) return false;

      const existing = getAccountData();
      if (existing?.address && isConnected) return true;

      const data = getZkLoginData();
      if (!data) return false;

      const dec = decodeJwt(jwt) as Partial<{
        sub: string;
        aud: string;
        iss: string;
        exp: number;
      }>;
      if (!dec.sub || !dec.aud || !dec.iss)
        throw new Error('Invalid JWT: missing sub/aud/iss');
      if (dec.exp && Date.now() / 1000 > dec.exp)
        throw new Error('JWT expired');

      if (
        lastSuccessRef.current?.jwt === jwt &&
        existing?.address === lastSuccessRef.current?.address
      ) {
        setIsConnected(true);
        return true;
      }

      const inflight = inflightMapRef.current.get(jwt);
      if (inflight) return inflight;

      const p = (async () => {
        const { address, proof, salt } = await createProof(
          zklogin.enokey,
          data.network,
          data.zkLogin,
          jwt,
        );

        const addressSeed = genAddressSeed(
          BigInt(salt),
          'sub',
          dec.sub!,
          dec.aud!,
        ).toString();

        setAccountData({
          zkLogin: {
            ...data.zkLogin,
            proofInfo: { addressSeed, proof, jwt, iss: dec.iss! },
          },
          network: data.network,
          address,
        });

        lastSuccessRef.current = { jwt, address };
        setIsConnected(true);
        return true;
      })();

      inflightMapRef.current.set(jwt, p);
      try {
        return await p;
      } finally {
        inflightMapRef.current.delete(jwt);
      }
    },
    [zklogin, isConnected],
  );

  const signAndExecuteSponsoredTransaction = async (
    wallet: WalletStandard,
    url: string,
    input: {
      transaction: {
        toJSON: () => Promise<string>;
      };
      network: NETWORK;
    },
  ): Promise<{
    digest: string;
    bytes: string;
    signature: string;
    effects: string;
  }> => {
    const account = getAccountData();
    const txb = Transaction.from(await input.transaction.toJSON());
    if (!!account && sponsoredUrl) {
      if (!!wallet.signer) {
        if (account.network === input.network) {
          const client = new SuiClient({
            url: getFullnodeUrl(account.network),
          });
          const txBytes = await txb.build({
            client,
            onlyTransactionKind: true,
          });
          const { bytes: sponsoredTxBuytes, digest } =
            await createSponsoredTransaction(
              url,
              account.network,
              account.address,
              txBytes,
            );
          const { signature } = await wallet.signer.signTransaction(
            fromBase64(sponsoredTxBuytes),
          );
          await executeSponsoredTransaction(url, digest, signature);

          const { rawEffects } = await client.waitForTransaction({
            digest,
            options: {
              showRawEffects: true,
            },
          });
          return {
            digest,
            bytes: toBase64(txBytes),
            signature,
            effects: rawEffects ? toBase64(new Uint8Array(rawEffects)) : '',
          };
        }
      } else {
        const { digest, bytes, signature, effects } = await openSignTxModal(
          'Sign Transaction',
          'Please scan the QR code to sign.',
          {
            transaction: txb,
            sponsoredUrl,
          },
        );
        return {
          digest,
          bytes,
          signature,
          effects,
        };
      }
      throw new Error('Chain error');
    }
    throw new Error("Can't sign and execute sponsored transaction");
  };

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      const walletStandard = new WalletStandard(
        name || DEFAULT_NAME,
        icon || DEFAULT_ICON,
        network,
        sponsoredUrl || '',
        mode || 'light',
        onEvent,
        setIsConnected,
        openSignTxModal,
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
    sponsoredUrl,
    zklogin,
    onEvent,
    setWallet,
    setMode,
    openSignTxModal,
  ]);

  return (
    <WalrusWalletContext.Provider
      value={{
        updateJwt,
        walrusWalletStatus: () => (isConnected ? 'connected' : 'disconnected'),
        openSignTxModal,
        signAndExecuteSponsoredTransaction:
          sponsoredUrl && wallet
            ? (input) =>
                signAndExecuteSponsoredTransaction(wallet, sponsoredUrl, input)
            : () => {
                throw new Error('Sponsored transaction not configured');
              },
      }}
    >
      <ActionDrawer
        isConnected={isConnected}
        icon={icon || DEFAULT_ICON}
        onLogout={() => {
          try {
            wallet?.logout();
          } finally {
            dappKitDisconnect();
            onEvent({ variant: 'success', message: 'Logged out' });
          }
        }}
        onEvent={onEvent}
      />
      {children}
    </WalrusWalletContext.Provider>
  );
};

export const WalrusWallet = ({
  children,
  icon,
  name,
  ...others
}: IWalrusWalletProps) => {
  return (
    <RecoilRoot>
      <WalrusScan
        mode={others.mode || 'light'}
        icon={icon || DEFAULT_ICON}
        {...others}
      >
        <WalrusWalletRoot
          name={name || DEFAULT_NAME}
          icon={icon || DEFAULT_ICON}
          {...others}
        >
          {children}
        </WalrusWalletRoot>
      </WalrusScan>
    </RecoilRoot>
  );
};

export const WALLET_NAME = DEFAULT_NAME;

export const useWalrusWallet = () => {
  const context = useContext(WalrusWalletContext);
  if (!context) {
    throw new Error(
      'useWalrusWallet hook can only be used inside a WalrusWallet provider.',
    );
  }
  return context;
};
