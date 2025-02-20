import React from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import {
  ReadonlyWalletAccount,
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  StandardEventsListeners,
  StandardEventsOnMethod,
  SUI_CHAINS,
  SuiFeatures,
  SuiSignAndExecuteTransactionMethod,
  SuiSignPersonalMessageMethod,
  SuiSignTransactionMethod,
  Wallet,
} from '@mysten/wallet-standard';
import mitt, { type Emitter } from 'mitt';
import ReactDOM from 'react-dom/client';

import { createNonce } from './createNonce';
import {
  disconnect,
  getAccountData,
  setAccountData,
  setZkLoginData,
} from './localStorage';
import { IAccount, NETWORK, NotiVariant } from './types';
import { cleanup, ZkLoginSigner } from './zkLoginSigner';
import { Password } from '../components/password';
import { QRLoginCode } from '../components/QRLoginCode';
import { QRSignCode } from '../components/QRSignCode';

type WalletEventsMap = {
  [E in keyof StandardEventsListeners]: Parameters<
    StandardEventsListeners[E]
  >[0];
};

const TIME_OUT = 300;

export class WalletStandard implements Wallet {
  readonly #events: Emitter<WalletEventsMap>;

  readonly #version = '1.0.0' as const;

  #accounts: ReadonlyWalletAccount[] = [];

  #name: string;
  #icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;

  #network: NETWORK;
  #zkLoginNonceCallback?: (nonce: string) => void;
  #epochOffset?: number;
  #onEvent: (data: { variant: NotiVariant; message: string }) => void;
  #setIsConnected: (isConnected: boolean) => void;
  #sponsored: string | undefined;

  #account: IAccount | undefined;
  #signer: ZkLoginSigner | undefined;

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

  get signer() {
    return this.#signer;
  }

  constructor(
    name: string,
    icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`,
    network: NETWORK,
    sponsored: string,
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
    setIsConnected: (isConnected: boolean) => void,
    zklogin?: {
      callbackNonce?: (nonce: string) => void;
      epochOffset?: number;
    },
  ) {
    this.#events = mitt();
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#sponsored = sponsored === '' ? undefined : sponsored;
    this.#onEvent = onEvent;
    this.#setIsConnected = setIsConnected;
    this.#epochOffset = zklogin?.epochOffset;
    this.#zkLoginNonceCallback = zklogin?.callbackNonce;
  }

  get features(): StandardConnectFeature &
    StandardDisconnectFeature &
    StandardEventsFeature &
    SuiFeatures {
    return {
      'standard:connect': {
        version: '1.0.0',
        connect: this.#connect,
      },
      'standard:events': {
        version: '1.0.0',
        on: this.#on,
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: this.#disconnect,
      },
      'sui:signTransaction': {
        version: '2.0.0',
        signTransaction: this.#signTransaction,
      },
      'sui:signAndExecuteTransaction': {
        version: '2.0.0',
        signAndExecuteTransaction: this.#signAndExecuteTransaction,
      },
      'sui:signPersonalMessage': {
        version: '1.0.0',
        signPersonalMessage: this.#signPersonalMessage,
      },
    };
  }

  #openZkLoginModal(): Promise<string> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <Password
          onClose={() => {
            cleanup(container, root);
            reject(new Error('rejected'));
          }}
          onConfirm={async (password: string) => {
            cleanup(container, root);
            const { nonce, data } = await createNonce(
              password,
              this.#network,
              this.#epochOffset,
            );
            setZkLoginData({ network: this.#network, zkLogin: data });
            resolve(nonce);
          }}
          onEvent={this.#onEvent}
        />,
      );
    });
  }

  #openQrLoginModal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <QRLoginCode
          icon={this.#icon}
          network={this.#network}
          onEvent={this.#onEvent}
          onClose={(result) => {
            cleanup(container, root);
            if (!!result) {
              setAccountData(result);
              resolve();
            } else {
              reject(new Error('rejected'));
            }
          }}
        />,
      );
    });
  }

  #on: StandardEventsOnMethod = (event, listener) => {
    this.#events.on(event, listener);
    return () => this.#events.off(event, listener);
  };

  #connected = async () => {
    if (this.#account) {
      this.#setIsConnected(true);
      this.#accounts = [
        new ReadonlyWalletAccount({
          address: this.#account.address,
          publicKey: new Uint8Array(),
          chains: [`sui:${this.#network}`],
          features: [
            'sui:signTransaction',
            'sui:signAndExecuteTransaction',
            'sui:signPersonalMessage',
          ],
        }),
      ];
    } else {
      this.#setIsConnected(false);
      this.#accounts = [];
    }
    if (this.#accounts.length) {
      this.#events.emit('change', { accounts: this.accounts });
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  };

  #connect: StandardConnectMethod = async (input) => {
    this.#account = getAccountData();
    if (!this.#account) {
      if (this.#zkLoginNonceCallback) {
        const nonce = await this.#openZkLoginModal();
        this.#zkLoginNonceCallback(nonce);
      } else {
        await this.#openQrLoginModal();
        this.#account = getAccountData();
      }
    } else if (this.#account.zkLogin) {
      this.#signer = new ZkLoginSigner(
        this.#network,
        this.#account.zkLogin,
        this.#account.address,
        this.#onEvent,
      );
    }
    await this.#connected();
    return { accounts: this.accounts };
  };

  #disconnect: StandardDisconnectMethod = (): Promise<void> => {
    if (this.#accounts.length > 0) {
      disconnect();
      this.#accounts = [];
      this.#account = undefined;
      this.#signer = undefined;
      this.#events.emit('change', { accounts: undefined });
    }
    return Promise.resolve();
  };

  logout = () => {
    this.#disconnect();
  };

  pay = async (
    title: string,
    description: string,
    data: { transaction: Transaction; isSponsored?: boolean },
  ): Promise<{
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }> => {
    return new Promise((resolve) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <QRSignCode
          option={{
            title,
            description,
            transaction: data.transaction,
          }}
          network={this.#network}
          sponsored={data.isSponsored ? this.#sponsored : undefined}
          icon={this.icon}
          onEvent={this.#onEvent}
          onClose={(result) => {
            cleanup(container, root);
            if (!!result) {
              resolve(result);
            }
          }}
        />,
      );
    });
  };

  #signTransaction: SuiSignTransactionMethod = async ({
    transaction,
    chain,
  }) => {
    if (chain === `sui:${this.#network}`) {
      if (this.#signer) {
        const client = new SuiClient({
          url: getFullnodeUrl(this.#network),
        });
        const tx = await transaction.toJSON();
        const txBytes = await Transaction.from(tx).build({ client });
        const { bytes, signature } =
          await this.#signer.signTransaction(txBytes);
        return {
          bytes,
          signature,
        };
      } else {
        const tx = await transaction.toJSON();
        const { bytes, signature } = await this.pay(
          'Sign Transaction',
          'Please scan the QR code to sign.',
          {
            transaction: Transaction.from(tx),
            isSponsored: false,
          },
        );
        return {
          bytes,
          signature,
        };
      }
    }
    throw new Error('chain error');
  };

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async ({
    transaction,
    chain,
  }) => {
    if (chain === `sui:${this.#network}`) {
      if (this.#signer) {
        const client = new SuiClient({
          url: getFullnodeUrl(this.#network),
        });
        const tx = await transaction.toJSON();
        const txBytes = await Transaction.from(tx).build({
          client,
        });
        const { bytes, signature } =
          await this.#signer.signTransaction(txBytes);
        const { digest, errors } = await client.executeTransactionBlock({
          transactionBlock: bytes,
          signature: signature,
        });
        if (errors) {
          throw new Error(errors.join(', '));
        }
        const { rawEffects } = await client.waitForTransaction({
          digest,
          options: {
            showRawEffects: true,
          },
        });
        return {
          digest,
          bytes,
          signature,
          effects: rawEffects ? toBase64(new Uint8Array(rawEffects)) : '',
        };
      } else {
        const tx = await transaction.toJSON();
        const { bytes, signature, digest, effects } = await this.pay(
          'Sign and Execute Transaction',
          'Please scan the QR code to sign.',
          {
            transaction: Transaction.from(tx),
            isSponsored: false,
          },
        );
        return {
          digest,
          bytes,
          signature,
          effects,
        };
      }
    }
    throw new Error('chain error');
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async ({ message }) => {
    if (this.#signer) {
      const { signature } = await this.#signer.signPersonalMessage(message);
      return {
        bytes: toBase64(message),
        signature,
      };
    }
    throw new Error('signer error');
  };
}
