import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Signer } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { genAddressSeed } from '@mysten/sui/zklogin';
import { registerWallet } from '@mysten/wallet-standard';
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
  useWalrusScan,
  WalrusScan,
} from '@zktx.io/walrus-scan';
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
import { NETWORK, NotiVariant } from './utils/types';
import { WalletStandard } from './utils/walletStandard';

interface IWalrusWalletContext {
  updateJwt: (jwt: string) => Promise<void>;
  isConnected: boolean;
  scan: (signer: Signer) => Promise<void>;
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
  name: string;
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
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
  const { scan, openSignTxModal } = useWalrusScan();
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
        name,
        icon,
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
        isConnected,
        scan,
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
      <WalrusScan mode={others.mode || 'light'} {...others}>
        <WalrusWalletRoot {...others}>{children}</WalrusWalletRoot>
      </WalrusScan>
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
