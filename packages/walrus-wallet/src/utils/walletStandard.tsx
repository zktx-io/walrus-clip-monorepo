import {
  StandardConnectMethod,
  StandardDisconnectMethod,
  StandardEventsListeners,
  StandardEventsOnMethod,
  SUI_CHAINS,
  SuiSignAndExecuteTransactionMethod,
  SuiSignPersonalMessageMethod,
  SuiSignTransactionMethod,
  Wallet,
  type ReadonlyWalletAccount,
} from '@mysten/wallet-standard';
import type { NETWORK, NotiVariant } from '../utils/walletTypes';
import mitt, { type Emitter } from 'mitt';

import {
  signAndExecuteWalletTransaction,
  signWalletPersonalMessage,
  signWalletTransaction,
} from '../runtime/signingRuntime';
import { WalletSession } from '../runtime/walletSession';
import {
  createWalrusWalletFeatures,
  type WalrusWalletFeatures,
} from '../runtime/walletCapabilities';
import { type WalletQrSignModal } from '../runtime/signingRoutes';

type WalletEventsMap = {
  [E in keyof StandardEventsListeners]: Parameters<
    StandardEventsListeners[E]
  >[0];
};

type WalletStandardRuntimeConfig = {
  name: string;
  icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  network: NETWORK;
  sponsoredUrl: string;
  mode: 'dark' | 'light';
  iceConfigUrl: string | undefined;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  setIsConnected: (isConnected: boolean) => void;
  openSignTxModal: WalletQrSignModal;
  zklogin?: {
    callbackNonce?: (nonce: string) => void;
    epochOffset?: number;
  };
};

export class WalletStandard implements Wallet {
  readonly #events: Emitter<WalletEventsMap>;

  readonly #version = '1.0.0' as const;

  #accounts: ReadonlyWalletAccount[] = [];
  #session: WalletSession;
  #name: string;
  #icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;

  #network: NETWORK;
  #sponsoredUrl: string | undefined;
  #openSignTxModal: WalletQrSignModal;

  get version() {
    return this.#version;
  }

  get name() {
    return this.#name;
  }

  get icon() {
    return this.#icon;
  }

  get chains() {
    return SUI_CHAINS;
  }

  get accounts() {
    return this.#accounts;
  }

  constructor(
    name: string,
    icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`,
    network: NETWORK,
    sponsoredUrl: string,
    mode: 'dark' | 'light',
    iceConfigUrl: string | undefined,
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
    setIsConnected: (isConnected: boolean) => void,
    openSignTxModal: WalletQrSignModal,
    zklogin?: {
      callbackNonce?: (nonce: string) => void;
      epochOffset?: number;
    },
  ) {
    this.#events = mitt();
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#sponsoredUrl = sponsoredUrl === '' ? undefined : sponsoredUrl;
    this.#openSignTxModal = openSignTxModal;
    this.#session = new WalletSession({
      icon,
      network,
      mode,
      iceConfigUrl,
      onEvent,
      setIsConnected,
      onAccountsChanged: this.#onAccountsChanged,
      zklogin,
    });
  }

  updateRuntime({
    name,
    icon,
    network,
    sponsoredUrl,
    mode,
    iceConfigUrl,
    onEvent,
    setIsConnected,
    openSignTxModal,
    zklogin,
  }: WalletStandardRuntimeConfig) {
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#sponsoredUrl = sponsoredUrl === '' ? undefined : sponsoredUrl;
    this.#openSignTxModal = openSignTxModal;
    this.#session.updateRuntime({
      icon,
      network,
      mode,
      iceConfigUrl,
      onEvent,
      setIsConnected,
      onAccountsChanged: this.#onAccountsChanged,
      zklogin,
    });
  }

  get features(): WalrusWalletFeatures {
    return createWalrusWalletFeatures({
      connect: this.#connect,
      disconnect: this.#disconnect,
      on: this.#on,
      signAndExecuteTransaction: this.#signAndExecuteTransaction,
      signTransaction: this.#signTransaction,
      signPersonalMessage: this.#signPersonalMessage,
    });
  }

  #on: StandardEventsOnMethod = (event, listener) => {
    this.#events.on(event, listener);
    return () => this.#events.off(event, listener);
  };

  #onAccountsChanged = (accounts: readonly ReadonlyWalletAccount[]) => {
    this.#accounts = [...accounts];
    this.#events.emit('change', { accounts: this.accounts });
  };

  #connect: StandardConnectMethod = async () => this.#session.connect();

  #disconnect: StandardDisconnectMethod = () => this.#session.disconnect();

  #createSigningRuntimeConfig = () => ({
    network: this.#network,
    sponsoredUrl: this.#sponsoredUrl,
    signer: this.#session.signer,
    activeAccount: this.#session.activeWalletAccount,
    openSignTxModal: this.#openSignTxModal,
  });

  #signTransaction: SuiSignTransactionMethod = async (input) =>
    signWalletTransaction(this.#createSigningRuntimeConfig(), input);

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async (
    input,
  ) => signAndExecuteWalletTransaction(this.#createSigningRuntimeConfig(), input);

  #signPersonalMessage: SuiSignPersonalMessageMethod = async (input) =>
    signWalletPersonalMessage(this.#createSigningRuntimeConfig(), input);
}
