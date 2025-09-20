import React from 'react';

import {
  PublicKey,
  SignatureScheme,
  SignatureWithBytes,
  Signer,
} from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import {
  getZkLoginSignature,
  toZkLoginPublicIdentifier,
} from '@mysten/sui/zklogin';
import ReactDOM from 'react-dom/client';

import { IZkLogin, NETWORK } from './types';
import { decryptText } from './utils';
import { PwConfirm } from '../components/PwConfirm';

const TIME_OUT = 300;

export const cleanup = (container: HTMLDivElement, root: ReactDOM.Root) => {
  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, TIME_OUT);
};

export class ZkLoginSigner extends Signer {
  #network: NETWORK;
  #zkLogin: IZkLogin;
  #address: string;
  #mode: 'dark' | 'light';

  get network(): NETWORK {
    return this.#network;
  }

  constructor(
    network: NETWORK,
    zkLogin: IZkLogin,
    address: string,
    mode: 'dark' | 'light',
  ) {
    super();
    this.#network = network;
    this.#zkLogin = zkLogin;
    this.#address = address;
    this.#mode = mode;
  }

  #openPasswordModal(): Promise<string> {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);
      root.render(
        <PwConfirm
          mode={this.#mode}
          onClose={() => {
            cleanup(container, root);
            reject(new Error('rejected'));
          }}
          onConfirm={async (password: string) => {
            try {
              const { iv, encrypted, salt } = this.#zkLogin.keypair.privateKey;
              const privateKey = await decryptText(
                password,
                encrypted,
                iv,
                salt,
              );
              if (!!privateKey) {
                cleanup(container, root);
                resolve(privateKey);
              } else {
                throw new Error('Invalid password.');
              }
            } catch (error) {
              throw new Error('Invalid password.');
            }
          }}
        />,
      );
    });
  }

  async #zkSign(
    bytes: Uint8Array,
    type: 'sign' | 'signTransaction' | 'signPersonalMessage',
  ): Promise<SignatureWithBytes> {
    const privateKey = await this.#openPasswordModal();
    const keypair = Ed25519Keypair.fromSecretKey(fromBase64(privateKey));

    let userSignature: string;
    if (type === 'sign') {
      const sig = await keypair.sign(bytes);
      userSignature = toBase64(sig);
    } else if (type === 'signTransaction') {
      userSignature = (await keypair.signTransaction(bytes)).signature;
    } else {
      userSignature = (await keypair.signPersonalMessage(bytes)).signature;
    }
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        ...JSON.parse(this.#zkLogin.proofInfo.proof),
        addressSeed: this.#zkLogin.proofInfo.addressSeed,
      },
      maxEpoch: this.#zkLogin.expiration,
      userSignature,
    });
    return {
      bytes: toBase64(bytes),
      signature: zkLoginSignature,
    };
  }

  getKeyScheme(): SignatureScheme {
    return 'ZkLogin';
  }

  getPublicKey(): PublicKey {
    return toZkLoginPublicIdentifier(
      BigInt(this.#zkLogin.proofInfo.addressSeed),
      this.#zkLogin.proofInfo.iss,
    );
  }

  toSuiAddress(): string {
    return this.#address;
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const { signature } = await this.#zkSign(bytes, 'sign');
    return fromBase64(signature);
  }

  async signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.#zkSign(bytes, 'signTransaction');
  }

  async signPersonalMessage(bytes: Uint8Array): Promise<SignatureWithBytes> {
    return this.#zkSign(bytes, 'signPersonalMessage');
  }
}
