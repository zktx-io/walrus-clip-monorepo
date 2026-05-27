import {
  ReadonlyWalletAccount,
  type StandardConnectOutput,
} from '@mysten/wallet-standard';
import type { NETWORK, NotiVariant } from '../utils/walletTypes';

import { openQrLoginModal, openZkLoginModal } from './loginRoutes';
import { createWalrusAccountFeatureNames } from './walletCapabilities';
import { disconnect, getAccountData } from '../utils/localStorage';
import type { IAccount } from '../utils/types';
import { ZkLoginSigner } from '../utils/zkLoginSigner';

type WalletSessionConfig = {
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  mode: 'dark' | 'light';
  iceConfigUrl?: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  setIsConnected: (isConnected: boolean) => void;
  onAccountsChanged: (accounts: readonly ReadonlyWalletAccount[]) => void;
  zklogin?: {
    callbackNonce?: (nonce: string) => void;
    epochOffset?: number;
  };
};

export class WalletSession {
  #accounts: ReadonlyWalletAccount[] = [];
  #account: IAccount | undefined;
  #signer: ZkLoginSigner | undefined;
  #config: WalletSessionConfig;

  constructor(config: WalletSessionConfig) {
    this.#config = config;
  }

  get accounts() {
    return this.#accounts;
  }

  get signer() {
    return this.#signer;
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
    this.#signer = undefined;

    if (!this.#account) {
      if (this.#config.zklogin?.callbackNonce) {
        const nonce = await openZkLoginModal({
          mode: this.#config.mode,
          network: this.#config.network,
          epochOffset: this.#config.zklogin.epochOffset,
          onEvent: this.#config.onEvent,
        });
        this.#config.zklogin.callbackNonce(nonce);
      } else {
        await openQrLoginModal({
          mode: this.#config.mode,
          icon: this.#config.icon,
          network: this.#config.network,
          iceConfigUrl: this.#config.iceConfigUrl,
          onEvent: this.#config.onEvent,
        });
        this.#account = getAccountData();
      }
    } else if (this.#account.zkLogin) {
      this.#signer = new ZkLoginSigner(
        this.#config.network,
        this.#account.zkLogin,
        this.#account.address,
        this.#config.mode,
      );
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
    this.#signer = undefined;
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
        publicKey: this.#signer
          ? this.#signer.getPublicKey().toSuiBytes()
          : new Uint8Array(),
        chains: [`sui:${this.#config.network}`],
        features: createWalrusAccountFeatureNames(!!this.#signer),
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
