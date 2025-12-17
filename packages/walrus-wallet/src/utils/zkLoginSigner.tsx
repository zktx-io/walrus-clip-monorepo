import React from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
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
import { NETWORK } from '@zktx.io/walrus-connect';
import ReactDOM from 'react-dom/client';

import { IZkLogin } from './types';
import { decryptText } from './utils';
import { PwConfirm } from '../components/PwConfirm';

export const cleanup = (container: HTMLDivElement, root: ReactDOM.Root) => {
  // Use requestAnimationFrame to ensure React finishes its work before cleanup
  requestAnimationFrame(() => {
    try {
      root.unmount();
    } catch {}
    try {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    } catch {}
  });
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
    const client = new SuiClient({ url: getFullnodeUrl(this.#network) });
    const { epoch } = await client.getLatestSuiSystemState();
    if (Number(epoch) > this.#zkLogin.expiration) {
      throw new Error('zkLogin session expired. Please reconnect.');
    }

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
