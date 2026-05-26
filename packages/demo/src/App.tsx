import { useState } from 'react';

import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import {
  createWalrusWalletDappKitNetworks,
  WalrusWallet,
} from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';

import { ICON, NETWORK } from './utils/config';
import './App.css';

import '@mysten/dapp-kit/dist/index.css';
import '@zktx.io/walrus-wallet/index.css';
import { Kiosk } from './components/Kiosk';

const SPONSORED_URL = import.meta.env.VITE_APP_SPONSORED_URL;
const SUI_NETWORKS = createWalrusWalletDappKitNetworks();

function App() {
  const [activeNetwork, setActiveNetwork] = useState<
    'testnet' | 'mainnet' | 'devnet'
  >(NETWORK);

  return (
    <SuiClientProvider
      networks={SUI_NETWORKS}
      defaultNetwork={activeNetwork}
      onNetworkChange={(network) => {
        setActiveNetwork(network);
      }}
    >
      <WalletProvider autoConnect>
        <WalrusWallet
          mode="light"
          icon={ICON}
          network={activeNetwork}
          sponsoredUrl={SPONSORED_URL}
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
          <Kiosk network={activeNetwork} />
        </WalrusWallet>
      </WalletProvider>
    </SuiClientProvider>
  );
}

export default App;
