import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import {
  createWalrusWalletDappKitNetworks,
  WalrusWallet,
} from '@zktx.io/walrus-wallet';
import { WalrusSignerScan } from '@zktx.io/walrus-connect/signer-app';
import { enqueueSnackbar } from 'notistack';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './App.css';
import '@mysten/dapp-kit/dist/index.css';
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
const SUI_NETWORKS = createWalrusWalletDappKitNetworks();

function App() {
  const [activeNetwork, setActiveNetwork] = useState<
    'testnet' | 'mainnet' | 'devnet'
  >(NETWORK);
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

  return (
    <SuiClientProvider
      networks={SUI_NETWORKS}
      defaultNetwork={activeNetwork as 'mainnet' | 'testnet' | 'devnet'}
      onNetworkChange={(network) => {
        setActiveNetwork(network);
      }}
    >
      <WalletProvider autoConnect>
        <WalrusWallet
          network={activeNetwork}
          sponsoredUrl={SPONSORED_URL}
          zklogin={{
            enokey: ENOKI_KEY!,
            callbackNonce: callbackNonce,
          }}
          onEvent={onWalletEvent}
        >
          <WalrusSignerScan
            mode="light"
            icon="/logo-walrus.png"
            network={activeNetwork}
            onEvent={onWalletEvent}
          >
            <RouterProvider router={router} />
          </WalrusSignerScan>
        </WalrusWallet>
      </WalletProvider>
    </SuiClientProvider>
  );
}

export default App;
