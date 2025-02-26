import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { WalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import './App.css';
import '@mysten/dapp-kit/dist/index.css';

import { GameBoy } from './pages/GameBoy';
import { Home } from './pages/Home';
import { Kiosk } from './pages/Kiosk';
import { Ticket } from './pages/Ticket';
import { ICON, WALLET_NAME } from './utils/config';
import { NETWORK } from './utils/config';

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
    path: 'ticket',
    element: <Ticket />,
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
