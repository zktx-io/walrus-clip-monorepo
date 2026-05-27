import { createDAppKit, DAppKitProvider, useCurrentNetwork } from '@mysten/dapp-kit-react';
import {
  createWalrusWalletSuiClient,
  WALRUS_WALLET_SUPPORTED_NETWORKS,
  WalrusWallet,
} from '@zktx.io/walrus-wallet';
import { WalrusSignerScan } from '@zktx.io/walrus-connect/signer-app';
import { enqueueSnackbar } from 'notistack';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './App.css';
import '@zktx.io/walrus-wallet/index.css';

import { Auth } from './pages/Auth';
import { Home } from './pages/Home';
import { NETWORK } from './utils/config';
import { getProviderUrl } from './utils/getProviderUrl';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/auth',
    element: <Auth />,
  },
]);

const ENOKI_KEY = import.meta.env.VITE_APP_ENOKI_KEY;
const SPONSORED_URL = import.meta.env.VITE_APP_SPONSORED_URL;
const CLIENT_ID = import.meta.env.VITE_APP_CLIENT_ID;

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

const callbackNonce = (nonce: string) => {
  if (nonce && CLIENT_ID) {
    window.location.replace(getProviderUrl(nonce, CLIENT_ID));
  }
};

function AppShell() {
  const currentNetwork = useCurrentNetwork();

  return (
    <WalrusWallet
      network={currentNetwork}
      sponsoredUrl={SPONSORED_URL}
      zklogin={{
        enokey: ENOKI_KEY!,
        callbackNonce: callbackNonce,
      }}
      onEvent={onWalletEvent}
      onLogout={() => dAppKit.disconnectWallet()}
    >
      <WalrusSignerScan
        mode="light"
        icon="/logo-walrus.png"
        network={currentNetwork}
        onEvent={onWalletEvent}
      >
        <RouterProvider router={router} />
      </WalrusSignerScan>
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
