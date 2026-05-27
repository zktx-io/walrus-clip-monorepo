import { useEffect, useRef, useState, type ReactNode } from 'react';

import { registerWallet } from '@mysten/wallet-standard';
import { useWalrusScan, WalrusScan } from './internal/walrusConnectRoute';

import { ActionDrawer } from './components/ActionDrawer';
import { useWalletState, WalletStateProvider } from './state/walletState';
import { DEFAULT_ICON, DEFAULT_NAME } from './utils/default';
import { getAccountData } from './utils/localStorage';
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
  type WalrusWalletErrorCode,
  type WalrusWalletErrorDetails,
} from './runtime/walletErrors';

interface IWalrusWalletProps {
  name?: string;
  icon?: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  mode?: 'dark' | 'light';
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onLogout?: () => void | Promise<void>;
  children: ReactNode;
}

const WalrusWalletRoot = ({
  name,
  icon,
  network,
  mode,
  iceConfigUrl,
  onEvent,
  onLogout,
  children,
}: IWalrusWalletProps) => {
  const walletRef = useRef<WalletStandard | undefined>(undefined);
  const { openSignTxModal } = useWalrusScan();
  const { setWallet, setMode } = useWalletState();
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const runtimeConfig = {
      name: name || DEFAULT_NAME,
      icon: icon || DEFAULT_ICON,
      network,
      mode: mode || 'light',
      iceConfigUrl,
      onEvent,
      setIsConnected,
      openSignTxModal,
    };

    if (!walletRef.current) {
      const walletStandard = new WalletStandard(
        runtimeConfig.name,
        runtimeConfig.icon,
        runtimeConfig.network,
        runtimeConfig.mode,
        runtimeConfig.iceConfigUrl,
        runtimeConfig.onEvent,
        runtimeConfig.setIsConnected,
        runtimeConfig.openSignTxModal,
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
    onEvent,
    setWallet,
    setMode,
    openSignTxModal,
  ]);

  return (
    <>
      <ActionDrawer
        isConnected={isConnected}
        icon={icon || DEFAULT_ICON}
        onEvent={onEvent}
        onLogout={onLogout}
      />
      {children}
    </>
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
