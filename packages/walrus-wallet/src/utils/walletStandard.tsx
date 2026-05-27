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
  mode: 'dark' | 'light';
  iceConfigUrl: string | undefined;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  setIsConnected: (isConnected: boolean) => void;
  openSignTxModal: WalletQrSignModal;
};

export class WalletStandard implements Wallet {
  readonly #events: Emitter<WalletEventsMap>;

  readonly #version = '1.0.0' as const;

  #accounts: ReadonlyWalletAccount[] = [];
  #session: WalletSession;
  #name: string;
  #icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;

  #network: NETWORK;
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
    mode: 'dark' | 'light',
    iceConfigUrl: string | undefined,
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
    setIsConnected: (isConnected: boolean) => void,
    openSignTxModal: WalletQrSignModal,
  ) {
    this.#events = mitt();
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#openSignTxModal = openSignTxModal;
    this.#session = new WalletSession({
      icon,
      network,
      mode,
      iceConfigUrl,
      onEvent,
      setIsConnected,
      onAccountsChanged: this.#onAccountsChanged,
    });
  }

  updateRuntime({
    name,
    icon,
    network,
    mode,
    iceConfigUrl,
    onEvent,
    setIsConnected,
    openSignTxModal,
  }: WalletStandardRuntimeConfig) {
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#openSignTxModal = openSignTxModal;
    this.#session.updateRuntime({
      icon,
      network,
      mode,
      iceConfigUrl,
      onEvent,
      setIsConnected,
      onAccountsChanged: this.#onAccountsChanged,
    });
  }

  get features(): WalrusWalletFeatures {
    return createWalrusWalletFeatures({
      connect: this.#connect,
      disconnect: this.#disconnect,
      on: this.#on,
      signAndExecuteTransaction: this.#signAndExecuteTransaction,
      signPersonalMessage: this.#signPersonalMessage,
      signTransaction: this.#signTransaction,
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

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async (
    input,
  ) =>
    signAndExecuteWalletTransaction(
      {
        network: this.#network,
        activeAccount: this.#session.activeWalletAccount,
        openSignTxModal: this.#openSignTxModal,
      },
      input,
    );

  #signTransaction: SuiSignTransactionMethod = async (input) =>
    signWalletTransaction(
      {
        network: this.#network,
        activeAccount: this.#session.activeWalletAccount,
        openSignTxModal: this.#openSignTxModal,
      },
      input,
    );

  #signPersonalMessage: SuiSignPersonalMessageMethod = async (input) =>
    signWalletPersonalMessage(
      {
        network: this.#network,
        activeAccount: this.#session.activeWalletAccount,
        openSignTxModal: this.#openSignTxModal,
      },
      input,
    );
}
