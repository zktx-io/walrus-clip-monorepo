import { WalrusScan } from '@zktx.io/walrus-connect';
import { enqueueSnackbar } from 'notistack';

import { ICON, NETWORK } from './utils/config';
import './App.css';

import '@zktx.io/walrus-connect/index.css';
import { Kiosk } from './components/Kiosk';

function App() {
  return (
    <WalrusScan
      mode="light"
      icon={ICON}
      network={NETWORK}
      onEvent={enqueueSnackbar}
    >
      <Kiosk />
    </WalrusScan>
  );
}

export default App;
