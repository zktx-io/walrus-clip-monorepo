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
import { disconnect, getAccountData, setNonceData } from './localStorage';
import { IAccount, NETWORK } from './types';
import { decryptText } from './utils';
import { Password } from '../components/password';
import { Password2 } from '../components/password2';

type WalletEventsMap = {
  [E in keyof StandardEventsListeners]: Parameters<
    StandardEventsListeners[E]
  >[0];
};

export class WalletStandard implements Wallet {
  readonly #events: Emitter<WalletEventsMap>;

  readonly #version = '1.0.0' as const;

  #accounts: ReadonlyWalletAccount[] = [];

  #zkLoginCallback?: (nonce: string) => void;
  #name: string;
  #icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`;
  #network: NETWORK;
  #epochOffset?: number;

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
    zkLogin: (nonce: string) => void,
    name: string,
    icon: `data:image/${'svg+xml' | 'webp' | 'png' | 'gif'};base64,${string}`,
    network: NETWORK,
    epochOffset?: number,
  ) {
    this.#events = mitt();
    this.#name = name;
    this.#icon = icon;
    this.#network = network;
    this.#epochOffset = epochOffset;
    this.#zkLoginCallback = zkLogin;
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

  #openPasswordModal() {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = ReactDOM.createRoot(container);
    root.render(
      <Password
        onClose={() => {
          root.unmount();
          document.body.removeChild(container);
          this.#zkLoginCallback!('');
        }}
        onConfirm={async (password: string) => {
          root.unmount();
          document.body.removeChild(container);
          const { nonce, data } = await createNonce(
            password,
            this.#network,
            this.#epochOffset,
          );
          setNonceData(data);
          this.#zkLoginCallback!(nonce);
        }}
      />,
    );
  }

  static #openPasswordModal2(account: IAccount): Promise<string> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <Password2
          onClose={() => {
            root.unmount();
            document.body.removeChild(container);
            reject(new Error('rejected'));
          }}
          onConfirm={async (password: string) => {
            root.unmount();
            document.body.removeChild(container);
            const { iv, encrypted } = account.nonce.keypair.privateKey;
            const privateKey = await decryptText(password, encrypted, iv);
            if (privateKey) {
              resolve(privateKey);
            } else {
              reject(new Error('Password Error.'));
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
    const account = getAccountData();
    if (account) {
      this.#accounts = [
        new ReadonlyWalletAccount({
          address: account?.zkAddress.address,
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
    if (!account && this.#zkLoginCallback) {
      this.#openPasswordModal();
      return { accounts: [] };
    } else {
      await this.#connected();
    }
    return { accounts: this.accounts };
  };

  #disconnect: StandardDisconnectMethod = (): Promise<void> => {
    disconnect();
    this.#accounts = [];
    return Promise.resolve();
  };

  static SignTransaction = async (
    account: IAccount,
    bytes: Uint8Array,
  ): Promise<{ bytes: string; signature: string }> => {
    const privateKey = await this.#openPasswordModal2(account);
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(privateKey));
    const { signature: userSignature } = await keypair.signTransaction(bytes);
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        ...JSON.parse(account.zkAddress.proof),
        addressSeed: account.zkAddress.addressSeed,
      },
      maxEpoch: account.nonce.expiration,
      userSignature,
    });

    return {
      bytes: toBase64(bytes),
      signature: zkLoginSignature,
    };
  };

  #signTransaction: SuiSignTransactionMethod = async ({
    transaction,
    chain,
  }) => {
    const account = getAccountData();
    if (account && chain === `sui:${this.#network}`) {
      const client = new SuiClient({
        url: getFullnodeUrl(account.nonce.network),
      });
      const tx = await transaction.toJSON();
      const txBytes = await Transaction.from(tx).build({ client });

      const { bytes, signature } = await WalletStandard.SignTransaction(
        account,
        txBytes,
      );
      return {
        bytes,
        signature,
      };
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
    if (account && chain === `sui:${this.#network}`) {
      const client = new SuiClient({
        url: getFullnodeUrl(account.nonce.network),
      });
      const tx = await transaction.toJSON();
      const txBytes = await Transaction.from(tx).build({
        client,
      });
      const { bytes, signature } = await WalletStandard.SignTransaction(
        account,
        txBytes,
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
    }
    if (!account) {
      throw new Error('account error');
    }
    throw new Error('chain error');
  };

  #signPersonalMessage: SuiSignPersonalMessageMethod = async ({ message }) => {
    throw new Error('Not implemented: signPersonalMessage');
  };
}
