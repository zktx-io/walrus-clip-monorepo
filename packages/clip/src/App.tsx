import { createDAppKit, DAppKitProvider, useCurrentNetwork } from '@mysten/dapp-kit-react';
import {
  createWalrusWalletSuiClient,
  WALRUS_WALLET_SUPPORTED_NETWORKS,
  WalrusWallet,
} from '@zktx.io/walrus-wallet';
import { WalrusSignerScan } from '@zktx.io/walrus-connect/signer-app';
import { enqueueSnackbar } from 'notistack';

import './App.css';
import '@zktx.io/walrus-wallet/index.css';

import { Home } from './pages/Home';
import { NETWORK } from './utils/config';

const ICE_CONFIG_URL = import.meta.env.VITE_APP_ICE_CONFIG_URL;

const dAppKit = createDAppKit({
  networks: [...WALRUS_WALLET_SUPPORTED_NETWORKS],
  createClient: createWalrusWalletSuiClient,
  defaultNetwork: NETWORK,
  slushWalletConfig: null,
  autoConnect: true,
});

const stringifyWalletEventMessage = (message: unknown): string => {
  if (typeof message === 'string') {
    return message;
  }

  if (message instanceof Error) {
    return message.message || message.name;
  }

  try {
    const serialized = JSON.stringify(message, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    return serialized ?? String(message);
  } catch {
    return String(message);
  }
};

const onWalletEvent = (notification: {
  variant: 'success' | 'warning' | 'info' | 'error';
  message: unknown;
}) => {
  enqueueSnackbar(stringifyWalletEventMessage(notification.message), {
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
      network={currentNetwork}
      iceConfigUrl={ICE_CONFIG_URL}
      onEvent={onWalletEvent}
      onLogout={() => dAppKit.disconnectWallet()}
    >
      <WalrusSignerScan
        mode="light"
        icon="/logo-walrus.png"
        network={currentNetwork}
        iceConfigUrl={ICE_CONFIG_URL}
        onEvent={onWalletEvent}
      >
        <Home />
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
