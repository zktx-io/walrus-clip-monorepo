import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { KinokoWallet } from '@zktx.io/kinoko-wallet';

import './App.css';
import '@mysten/dapp-kit/dist/index.css';

import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { ENOKI, ICON, SPONSORED, WALLET_NAME } from './utils/.config';
import { getProviderUrl } from './utils/getProviderUrl';
import { NETWORK } from './utils/.config';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Home />,
  },
  {
    path: '/login',
    element: <Login />,
  },
]);

function App() {
  const [activeNetwork, setActiveNetwork] = useState<
    'testnet' | 'mainnet' | 'devnet'
  >(NETWORK);

  const zkLoginHandle = (nonce: string) => {
    if (nonce) {
      window.location.replace(getProviderUrl(nonce));
    }
  };

  return (
    <KinokoWallet
      name={WALLET_NAME}
      icon={ICON}
      network={activeNetwork}
      enokey={ENOKI}
      sponsored={SPONSORED}
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
