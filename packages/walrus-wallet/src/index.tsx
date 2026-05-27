import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { genAddressSeed } from '@mysten/sui/zklogin';
import { registerWallet } from '@mysten/wallet-standard';
import { useWalrusScan, WalrusScan } from './internal/walrusConnectRoute';
import { decodeJwt } from 'jose';

import { ActionDrawer } from './components/ActionDrawer';
import { useWalletState, WalletStateProvider } from './state/walletState';
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

type NETWORK = 'mainnet' | 'testnet' | 'devnet';
type NotiVariant = 'success' | 'warning' | 'info' | 'error';

export const WALRUS_WALLET_SUPPORTED_NETWORKS = [
  'mainnet',
  'testnet',
  'devnet',
] as const;
export { createWalrusWalletSuiClient } from './utils/publicSuiClient';
export {
  formatWalrusCoinAmount,
  getWalrusCoinBalances,
  getWalrusCoins,
  type WalrusCoinBalance,
} from './utils/coinHelpers';
export {
  WalrusWalletAccountMismatchError,
  WalrusWalletChainMismatchError,
  WalrusWalletError,
  WalrusWalletFeatureUnavailableError,
  WalrusWalletLoginRouteError,
  WalrusWalletQrRouteError,
  WalrusWalletTransactionExecutionError,
  WalrusWalletTransactionUncertainError,
  type WalrusWalletErrorCode,
  type WalrusWalletErrorDetails,
} from './runtime/walletErrors';

interface IWalrusWalletContext {
  updateJwt: (jwt: string) => Promise<boolean>;
  walrusWalletStatus: () => 'connected' | 'disconnected';
}

interface IWalrusWalletProps {
  name?: string;
  icon?: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  mode?: 'dark' | 'light';
  iceConfigUrl?: string;
  sponsoredUrl?: string;
  zklogin?: {
    enokey: string;
    callbackNonce: (nonce: string) => void;
    epochOffset?: number;
  };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onLogout?: () => void | Promise<void>;
  children: ReactNode;
}

const WalrusWalletContext = createContext<IWalrusWalletContext | undefined>(
  undefined,
);

const WalrusWalletRoot = ({
  name,
  icon,
  network,
  mode,
  iceConfigUrl,
  sponsoredUrl,
  zklogin,
  onEvent,
  onLogout,
  children,
}: IWalrusWalletProps) => {
  const walletRef = useRef<WalletStandard | undefined>(undefined);
  const inflightMapRef = useRef<
    Map<string, { promise: Promise<boolean>; timestamp: number }>
  >(new Map());
  const lastSuccessRef = useRef<{ jwt?: string; address?: string } | null>(
    // eslint-disable-next-line no-restricted-syntax
    null,
  );
  const { openSignTxModal } = useWalrusScan();
  const { setWallet, setMode } = useWalletState();
  const [isConnected, setIsConnected] = useState<boolean>(false);

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

      // Clean up stale inflight requests (older than 30 seconds)
      const now = Date.now();
      for (const [key, entry] of inflightMapRef.current.entries()) {
        if (now - entry.timestamp > 30000) {
          inflightMapRef.current.delete(key);
        }
      }

      const inflight = inflightMapRef.current.get(jwt);
      if (inflight) return inflight.promise;

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
            proofInfo: { addressSeed, proof, jwt: '', iss: dec.iss! },
          },
          network: data.network,
          address,
        });

        lastSuccessRef.current = { jwt, address };
        setIsConnected(true);
        return true;
      })();

      inflightMapRef.current.set(jwt, { promise: p, timestamp: now });
      try {
        return await p;
      } finally {
        inflightMapRef.current.delete(jwt);
      }
    },
    [zklogin, isConnected],
  );

  useEffect(() => {
    const runtimeConfig = {
      name: name || DEFAULT_NAME,
      icon: icon || DEFAULT_ICON,
      network,
      sponsoredUrl: sponsoredUrl || '',
      mode: mode || 'light',
      iceConfigUrl,
      onEvent,
      setIsConnected,
      openSignTxModal,
      zklogin: {
        epochOffset: zklogin?.epochOffset,
        callbackNonce: zklogin?.callbackNonce,
      },
    };

    if (!walletRef.current) {
      const walletStandard = new WalletStandard(
        runtimeConfig.name,
        runtimeConfig.icon,
        runtimeConfig.network,
        runtimeConfig.sponsoredUrl,
        runtimeConfig.mode,
        runtimeConfig.iceConfigUrl,
        runtimeConfig.onEvent,
        runtimeConfig.setIsConnected,
        runtimeConfig.openSignTxModal,
        runtimeConfig.zklogin,
      );
      walletRef.current = walletStandard;
      setWallet(walletStandard);
      registerWallet(walletStandard);
    } else {
      walletRef.current.updateRuntime(runtimeConfig);
    }

    setMode(runtimeConfig.mode);
    const account = getAccountData();
    setIsConnected(!!account && account.network === runtimeConfig.network);
  }, [
    name,
    icon,
    network,
    mode,
    iceConfigUrl,
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
      }}
    >
      <ActionDrawer
        isConnected={isConnected}
        icon={icon || DEFAULT_ICON}
        onEvent={onEvent}
        onLogout={onLogout}
      />
      {children}
    </WalrusWalletContext.Provider>
  );
};

export const WalrusWallet = ({
  children,
  icon,
  name,
  iceConfigUrl,
  ...others
}: IWalrusWalletProps) => {
  return (
    <WalletStateProvider>
      <WalrusScan
        mode={others.mode || 'light'}
        icon={icon || DEFAULT_ICON}
        iceConfigUrl={iceConfigUrl}
        {...others}
      >
        <WalrusWalletRoot
          name={name || DEFAULT_NAME}
          icon={icon || DEFAULT_ICON}
          iceConfigUrl={iceConfigUrl}
          {...others}
        >
          {children}
        </WalrusWalletRoot>
      </WalrusScan>
    </WalletStateProvider>
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
