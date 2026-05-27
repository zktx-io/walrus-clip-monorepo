import { createDAppKit, DAppKitProvider, useCurrentNetwork } from '@mysten/dapp-kit-react';
import {
  createWalrusWalletSuiClient,
  WALRUS_WALLET_SUPPORTED_NETWORKS,
  WalrusWallet,
} from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';

import { ICON, NETWORK } from './utils/config';
import './App.css';

import '@zktx.io/walrus-wallet/index.css';
import { Kiosk } from './components/Kiosk';

const SPONSORED_URL = import.meta.env.VITE_APP_SPONSORED_URL;

const dAppKit = createDAppKit({
  networks: [...WALRUS_WALLET_SUPPORTED_NETWORKS],
  createClient: createWalrusWalletSuiClient,
  defaultNetwork: NETWORK,
  slushWalletConfig: null,
  autoConnect: true,
});

const onWalletEvent = (notification: {
  variant: 'success' | 'warning' | 'info' | 'error';
  message: string;
}) => {
  enqueueSnackbar(notification.message, {
    variant: notification.variant,
    style: {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  });
};

function AppShell() {
  const currentNetwork = useCurrentNetwork();

  return (
    <WalrusWallet
      mode="light"
      icon={ICON}
      network={currentNetwork}
      sponsoredUrl={SPONSORED_URL}
      onEvent={onWalletEvent}
      onLogout={() => dAppKit.disconnectWallet()}
    >
      <Kiosk network={currentNetwork} />
    </WalrusWallet>
  );
}

function App() {
  return (
    <DAppKitProvider dAppKit={dAppKit}>
      <AppShell />
    </DAppKitProvider>
  );
}

export default App;
