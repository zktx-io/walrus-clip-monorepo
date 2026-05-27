import {
  QRLogin,
  loginHostOutcomeToResult,
} from '../internal/walrusConnectRoute';
import type { LoginHostOutcome } from '../internal/walrusConnectRoute';
import { createRoot } from 'react-dom/client';

import { PwCreate } from '../components/PwCreate';
import { createNonce } from '../utils/createNonce';
import { setAccountData, setZkLoginData } from '../utils/localStorage';
import type { NETWORK, NotiVariant } from '../utils/walletTypes';
import {
  cleanupWalletModalRoot,
  createWalletModalContainer,
} from '../utils/modalRoot';
import { WalrusWalletLoginRouteError } from './walletErrors';

const loginRouteErrorFromOutcome = (outcome: LoginHostOutcome) =>
  new WalrusWalletLoginRouteError({
    reason:
      outcome.type === 'connected'
        ? 'Login route returned a non-error connected result as an error.'
        : outcome.reason,
    address: 'address' in outcome ? outcome.address : undefined,
    network: 'network' in outcome ? outcome.network : undefined,
    accountPersisted: outcome.type === 'connected',
  });

export const openZkLoginModal = ({
  mode,
  network,
  epochOffset,
  onEvent,
}: {
  mode: 'dark' | 'light';
  network: NETWORK;
  epochOffset?: number;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}): Promise<string> =>
  new Promise((resolve, reject) => {
    const { container, portalContainer, topLayerHost } =
      createWalletModalContainer({ topLayer: true });
    const root = createRoot(container);
    root.render(
      <PwCreate
        mode={mode}
        portalContainer={portalContainer}
        onClose={() => {
          cleanupWalletModalRoot(container, root, topLayerHost);
          reject(new Error('rejected'));
        }}
        onConfirm={async (password: string) => {
          const { nonce, data } = await createNonce(
            password,
            network,
            epochOffset,
          );
          setZkLoginData({ network, zkLogin: data });
          cleanupWalletModalRoot(container, root, topLayerHost);
          resolve(nonce);
        }}
        onEvent={onEvent}
      />,
    );
  });

export const openQrLoginModal = ({
  mode,
  icon,
  network,
  iceConfigUrl,
  onEvent,
}: {
  mode: 'dark' | 'light';
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}): Promise<void> =>
  new Promise((resolve, reject) => {
    const { container, portalContainer, topLayerHost } =
      createWalletModalContainer({ topLayer: true });
    const root = createRoot(container);
    root.render(
      <QRLogin
        mode={mode}
        icon={icon}
        network={network}
        iceConfigUrl={iceConfigUrl}
        portalContainer={portalContainer}
        onEvent={onEvent}
        onClose={(outcome: LoginHostOutcome) => {
          cleanupWalletModalRoot(container, root, topLayerHost);
          const result = loginHostOutcomeToResult(outcome);
          if (result) {
            setAccountData(result);
            resolve();
          } else {
            reject(loginRouteErrorFromOutcome(outcome));
          }
        }}
      />,
    );
  });
