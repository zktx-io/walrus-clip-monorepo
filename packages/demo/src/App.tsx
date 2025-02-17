import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { WalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';

import './App.css';
import '@mysten/dapp-kit/dist/index.css';

import { Home } from './pages/Home';
import { ICON, WALLET_NAME } from './utils/config';
import { NETWORK } from './utils/config';
import { Kiosk } from './pages/Kiosk';
import { GameBoy } from './pages/GameBoy';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: 'kiosk',
    element: <Kiosk />,
  },
  {
    path: 'game',
    element: <GameBoy />,
  },
]);

const SPONSORED_URL = import.meta.env.VITE_APP_SPONSORED_URL;

function App() {
  const [activeNetwork, setActiveNetwork] = useState<
    'testnet' | 'mainnet' | 'devnet'
  >(NETWORK);

  return (
    <WalrusWallet
      name={WALLET_NAME}
      icon={ICON}
      network={activeNetwork}
      sponsored={SPONSORED_URL}
      onEvent={(notification) => {
        enqueueSnackbar(notification.message, {
          variant: notification.variant,
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
        <WalletProvider autoConnect>
          <RouterProvider router={router} />
        </WalletProvider>
      </SuiClientProvider>
    </WalrusWallet>
  );
}

export default App;
