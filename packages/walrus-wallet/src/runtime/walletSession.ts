import {
  ReadonlyWalletAccount,
  type StandardConnectOutput,
} from '@mysten/wallet-standard';
import { fromBase64 } from '@mysten/sui/utils';
import type { NETWORK, NotiVariant } from '../utils/walletTypes';

import { openQrLoginModal } from './loginRoutes';
import { WALRUS_ACCOUNT_FEATURE_NAMES } from './walletCapabilities';
import { disconnect, getAccountData } from '../utils/localStorage';
import type { IAccount } from '../utils/localStorage';

type WalletSessionConfig = {
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  mode: 'dark' | 'light';
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  setIsConnected: (isConnected: boolean) => void;
  onAccountsChanged: (accounts: readonly ReadonlyWalletAccount[]) => void;
};

export class WalletSession {
  #accounts: ReadonlyWalletAccount[] = [];
  #account: IAccount | undefined;
  #config: WalletSessionConfig;

  constructor(config: WalletSessionConfig) {
    this.#config = config;
  }

  get accounts() {
    return this.#accounts;
  }

  get activeWalletAccount() {
    return this.#accounts[0];
  }

  updateRuntime(config: WalletSessionConfig) {
    this.#config = config;
    if (!this.#handleNetworkMismatch()) {
      void this.#syncWalletAccount();
    }
  }

  connect = async (): Promise<StandardConnectOutput> => {
    this.#account = getAccountData();

    if (!this.#account) {
      await openQrLoginModal({
        mode: this.#config.mode,
        icon: this.#config.icon,
        network: this.#config.network,
        iceConfigUrl: this.#config.iceConfigUrl,
        onEvent: this.#config.onEvent,
      });
      this.#account = getAccountData();
    }

    if (this.#handleNetworkMismatch()) {
      return { accounts: this.accounts };
    }

    await this.#syncWalletAccount();
    return { accounts: this.accounts };
  };

  disconnect = async (): Promise<void> => {
    disconnect();
    this.#accounts = [];
    this.#account = undefined;
    this.#config.onAccountsChanged([]);
    this.#config.setIsConnected(false);
  };

  #handleNetworkMismatch = () => {
    if (!this.#account || this.#account.network === this.#config.network) {
      return false;
    }
    this.#config.onEvent({
      variant: 'error',
      message: `Network mismatch: stored=${this.#account.network}, wallet=${this.#config.network}`,
    });
    void this.disconnect();
    return true;
  };

  #syncWalletAccount = async () => {
    if (this.#account) {
      this.#config.setIsConnected(true);
      const account = new ReadonlyWalletAccount({
        address: this.#account.address,
        publicKey: fromBase64(this.#account.publicKey),
        chains: [`sui:${this.#config.network}`],
        features: WALRUS_ACCOUNT_FEATURE_NAMES,
      });
      this.#accounts = [account];
    } else {
      this.#config.setIsConnected(false);
      this.#accounts = [];
    }
    this.#config.onAccountsChanged(this.#accounts);
    await new Promise((resolve) => setTimeout(resolve, 5));
  };
}
