import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { WalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './App.css';
import '@mysten/dapp-kit/dist/index.css';

import { Auth } from './pages/Auth';
import { Home } from './pages/Home';
import { ICON, WALLET_NAME } from './utils/config';
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

function App() {
  const [activeNetwork, setActiveNetwork] = useState<
    'testnet' | 'mainnet' | 'devnet'
  >(NETWORK);

  const callbackNonce = (nonce: string) => {
    if (nonce && CLIENT_ID) {
      window.location.replace(getProviderUrl(nonce, CLIENT_ID));
    }
  };

  return (
    <WalrusWallet
      mode="light"
      name={WALLET_NAME}
      icon={ICON}
      network={activeNetwork}
      sponsored={SPONSORED_URL}
      zklogin={{
        enokey: ENOKI_KEY!,
        callbackNonce: callbackNonce,
      }}
      onEvent={(notification) => {
        enqueueSnackbar(notification.message, {
          variant: notification.variant,
          style: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        });
      }}
    >
      <SuiClientProvider
        networks={{
          mainnet: { url: getFullnodeUrl('mainnet') },
          testnet: { url: getFullnodeUrl('testnet') },
          devnet: { url: getFullnodeUrl('devnet') },
        }}
        defaultNetwork={activeNetwork as 'mainnet' | 'testnet' | 'devnet'}
        onNetworkChange={(network) => {
          setActiveNetwork(network);
        }}
      >
        <WalletProvider
          autoConnect
          stashedWallet={{
            name: 'stashed wallet',
            network: activeNetwork as 'mainnet' | 'testnet',
          }}
        >
          <RouterProvider router={router} />
        </WalletProvider>
      </SuiClientProvider>
    </WalrusWallet>
  );
}

export default App;
