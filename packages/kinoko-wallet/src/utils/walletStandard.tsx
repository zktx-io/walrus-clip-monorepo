import React from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { getZkLoginSignature } from '@mysten/sui/zklogin';
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
import { IZkLogin, NETWORK, NotiVariant } from './types';
import { decryptText } from './utils';
import { Password } from '../components/password';
import { Password2 } from '../components/password2';
import { QRLoginCode } from '../components/QRLoginCode';
import { QRPayCode } from '../components/QRPayCode';

type WalletEventsMap = {
  [E in keyof StandardEventsListeners]: Parameters<
    StandardEventsListeners[E]
  >[0];
};

export const TIME_OUT = 300;

export class WalletStandard implements Wallet {
  readonly #events: Emitter<WalletEventsMap>;

  readonly #version = '1.0.0' as const;

  #accounts: ReadonlyWalletAccount[] = [];

  #name: string;
  #icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;

  #zkLoginNonceCallback?: (nonce: string) => void;
  #network: NETWORK;
  #epochOffset?: number;
  #onEvent: (data: { variant: NotiVariant; message: string }) => void;
  #sponsored: string | undefined;

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
    sponsored: string,
    onEvent: (data: { variant: NotiVariant; message: string }) => void,
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

  #openZkLoginModal() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    root.render(
      <Password
        onClose={() => {
          setTimeout(() => {
            root.unmount();
            document.body.removeChild(container);
            document.body.style.pointerEvents = '';
          }, TIME_OUT);
          this.#disconnect();
        }}
        onConfirm={async (password: string) => {
          setTimeout(() => {
            root.unmount();
            document.body.removeChild(container);
            document.body.style.pointerEvents = '';
          }, TIME_OUT);
          const { nonce, network, data } = await createNonce(
            password,
            this.#network,
            this.#epochOffset,
          );
          setZkLoginData({ network, zkLogin: data });
          this.#zkLoginNonceCallback!(nonce);
        }}
        onEvent={this.#onEvent}
      />,
    );
  }

  #openQrLoginModal() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    root.render(
      <QRLoginCode
        icon={this.#icon}
        network={this.#network}
        onEvent={this.#onEvent}
        onClose={(result) => {
          setTimeout(() => {
            root.unmount();
            document.body.removeChild(container);
            document.body.style.pointerEvents = '';
          }, TIME_OUT);
          if (!!result) {
            setAccountData(result);
            this.#connected();
          } else {
            this.#disconnect();
          }
        }}
      />,
    );
  }

  #openPasswordModal(zkLogin: IZkLogin): Promise<string> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <Password2
          onClose={() => {
            setTimeout(() => {
              root.unmount();
              document.body.removeChild(container);
            }, TIME_OUT);
            reject(new Error('rejected'));
          }}
          onConfirm={async (password: string) => {
            setTimeout(() => {
              root.unmount();
              document.body.removeChild(container);
            }, TIME_OUT);
            const { iv, encrypted } = zkLogin.keypair.privateKey;
            const privateKey = await decryptText(password, encrypted, iv);
            if (privateKey) {
              resolve(privateKey);
            } else {
              reject(new Error('Password Error.'));
            }
          }}
          onEvent={this.#onEvent}
        />,
      );
    });
  }

  #on: StandardEventsOnMethod = (event, listener) => {
    this.#events.on(event, listener);
    return () => this.#events.off(event, listener);
  };

  #connected = async () => {
    const account = getAccountData();
    if (account) {
      this.#accounts = [
        new ReadonlyWalletAccount({
          address: account.address,
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
      this.#accounts = [];
    }
    if (this.#accounts.length) {
      this.#events.emit('change', { accounts: this.accounts });
    }
  };

  #connect: StandardConnectMethod = async (input) => {
    const account = getAccountData();
    if (!account) {
      if (this.#zkLoginNonceCallback) {
        this.#openZkLoginModal();
      } else {
        this.#openQrLoginModal();
      }
      return { accounts: [] };
    } else {
      await this.#connected();
    }
    return { accounts: this.accounts };
  };

  #disconnect: StandardDisconnectMethod = (): Promise<void> => {
    disconnect();
    this.#accounts = [];
    this.#events.emit('change', { accounts: this.accounts });
    return Promise.resolve();
  };

  sign = async (
    zkLogin: IZkLogin,
    bytes: Uint8Array,
    isTransaction: boolean,
  ): Promise<{ bytes: string; signature: string }> => {
    const privateKey = await this.#openPasswordModal(zkLogin);
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(privateKey));
    const { signature: userSignature } = await (isTransaction
      ? keypair.signTransaction(bytes)
      : keypair.signPersonalMessage(bytes));
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        ...JSON.parse(zkLogin.proofInfo.proof),
        addressSeed: zkLogin.proofInfo.addressSeed,
      },
      maxEpoch: zkLogin.expiration,
      userSignature,
    });

    return {
      bytes: toBase64(bytes),
      signature: zkLoginSignature,
    };
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
        <QRPayCode
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
            setTimeout(() => {
              root.unmount();
              document.body.removeChild(container);
            }, TIME_OUT);
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
    const account = getAccountData();
    if (!!account) {
      if (!!account.zkLogin && chain === `sui:${this.#network}`) {
        const client = new SuiClient({
          url: getFullnodeUrl(account.network),
        });
        const tx = await transaction.toJSON();
        const txBytes = await Transaction.from(tx).build({ client });

        const { bytes, signature } = await this.sign(
          account.zkLogin,
          txBytes,
          true,
        );
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
    if (!account) {
      throw new Error('account error');
    }
    throw new Error('chain error');
  };

  #signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod = async ({
    transaction,
    chain,
  }) => {
    const account = getAccountData();
    if (!!account) {
      if (!!account.zkLogin && chain === `sui:${this.#network}`) {
        const client = new SuiClient({
          url: getFullnodeUrl(account.network),
        });
        const tx = await transaction.toJSON();
        const txBytes = await Transaction.from(tx).build({
          client,
        });
        const { bytes, signature } = await this.sign(
          account.zkLogin,
          txBytes,
          true,
        );
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
    if (!account) {
      throw new Error('account error');
    }
    throw new Error('chain error');
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async ({ message }) => {
    const account = getAccountData();
    if (!!account) {
      if (!!account.zkLogin) {
        const { signature } = await this.sign(account.zkLogin, message, false);
        return {
          bytes: toBase64(message),
          signature,
        };
      } else {
        //
      }
    }
    throw new Error('account error');
  };
}
