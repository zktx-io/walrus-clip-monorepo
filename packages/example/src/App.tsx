import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { KinokoWallet } from '@zktx.io/kinoko-wallet';

import './App.css';
import '@mysten/dapp-kit/dist/index.css';

import { Home } from './pages/Home';
import { Auth } from './pages/Auth';
import { ICON, WALLET_NAME } from './utils/config';
import { getProviderUrl } from './utils/getProviderUrl';
import { NETWORK } from './utils/config';

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

const ENOKI_KEY = process.env.REACT_APP_ENOKI_KEY;
const SPONSORED_URL = process.env.REACT_APP_SPONSORED_URL;
const CLIENT_ID = process.env.REACT_APP_CLIENT_ID;

function App() {
  const [activeNetwork, setActiveNetwork] = useState<
    'testnet' | 'mainnet' | 'devnet'
  >(NETWORK);

  const zkLoginHandle = (nonce: string) => {
    if (nonce) {
      window.location.replace(getProviderUrl(nonce, CLIENT_ID!));
    }
  };

  return (
    <KinokoWallet
      name={WALLET_NAME}
      icon={ICON}
      network={activeNetwork}
      enokey={ENOKI_KEY!}
      sponsored={SPONSORED_URL}
      zkLogin={zkLoginHandle}
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
        <WalletProvider autoConnect>
          <RouterProvider router={router} />
        </WalletProvider>
      </SuiClientProvider>
    </KinokoWallet>
  );
}

export default App;
