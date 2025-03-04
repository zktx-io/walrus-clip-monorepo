import { Signer } from '@mysten/sui/cryptography';
import { fromBase64, toBase58, toBase64 } from '@mysten/sui/utils';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { sha256 } from '@noble/hashes/sha256';

import { Aggregator, Network, Publisher } from './config';

const jsonToBase64Url = (json: { [key: string]: any }): string => {
  const bytes = new TextEncoder().encode(JSON.stringify(json));
  return toBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export class WalrusSign {
  private readonly signer: Signer;
  private readonly issuer: string;
  private network: Network;

  constructor(signer: Signer, network: Network, issuer?: string) {
    this.signer = signer;
    this.network = network;
    this.issuer = issuer ?? signer.getPublicKey().toSuiPublicKey();
  }

  private async fetchPublicKeyFromIssuer(url: string): Promise<string[]> {
    try {
      const response = await fetch(
        `${url.replace(/\/$/, '')}/.well-known/walrus-sign.json`,
      );
      if (!response.ok) {
        throw new Error('Failed to fetch public keys');
      }
      const publicKeys = await response.json();
      return Array.isArray(publicKeys) ? publicKeys : [];
    } catch (error) {
      throw new Error(`Failed to fetch public keys from ${url}: ${error}`);
    }
  }

  private static calculateEpochs(
    expire: number,
    epochDurationDays = 2,
  ): number {
    const now = Math.floor(Date.now() / 1000);
    const epochDurationSeconds = epochDurationDays * 24 * 60 * 60;
    return Math.ceil((expire - now) / epochDurationSeconds);
  }

  private async createSignedJWT(
    payload: { [x: string]: any },
    subject: string,
    expire: number,
    audience?: string | string[],
  ): Promise<string> {
    const header = {
      alg: this.signer.getKeyScheme(),
      typ: 'SUI',
    };
    const jwtPayload: { [key: string]: any } = {
      ...payload,
      iss: this.issuer,
      sub: subject,
      exp: Math.floor(expire / 1000),
      iat: Math.floor(Date.now() / 1000),
    };

    if (audience) {
      jwtPayload.aud = audience;
    }

    const encodedHeader = jsonToBase64Url(header);
    const encodedPayload = jsonToBase64Url(jwtPayload);
    const dataToSign = new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`,
    );
    const { signature } = await this.signer.signPersonalMessage(dataToSign);
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async signJWT(
    subject: string,
    expire: number,
    payload: { [x: string]: any },
    audience?: string | string[],
  ): Promise<string> {
    return this.createSignedJWT(
      { data: { ...payload } },
      subject,
      expire,
      audience,
    );
  }

  async createTrust(token: string, expire: number): Promise<string> {
    const [payload] = token.split('.');
    const payloadJson = JSON.parse(
      new TextDecoder().decode(fromBase64(payload)),
    );
    const hash = toBase64(sha256(new TextEncoder().encode(token)));

    const trust = await this.createSignedJWT(
      { hash },
      payloadJson.sub,
      expire,
      payloadJson.aud,
    );

    const url = Publisher[this.network];
    const epochs = WalrusSign.calculateEpochs(expire);
    const res = await fetch(`${url}/blobs?epochs=${epochs}`, {
      method: 'PUT',
      body: trust,
    });

    if (res.status === 200) {
      const { newlyCreated } = await res.json();
      if (newlyCreated && newlyCreated.blobObject) {
        const blobId = toBase58(fromBase64(newlyCreated.blobObject.blobId));
        return this.createSignedJWT(
          { data: token, 'blob-id': blobId },
          payloadJson.sub,
          expire,
          payloadJson.aud,
        );
      } else {
        throw new Error('Something went wrong when storing the blob! (1)');
      }
    } else {
      throw new Error('Something went wrong when storing the blob! (2)');
    }
  }

  async verifyJWT(token: string): Promise<{ [x: string]: any } | undefined> {
    const [header, payload, signature] = token.split('.');
    const headerJson = JSON.parse(new TextDecoder().decode(fromBase64(header)));

    if (headerJson.typ === 'JWT') {
      throw new Error('Invalid token type');
    }

    try {
      const payloadJson = JSON.parse(
        new TextDecoder().decode(fromBase64(payload)),
      );

      if (payloadJson['blob-id']) {
        const url = Aggregator[this.network];
        const res = await fetch(`${url}/blobs/${payloadJson['blob-id']}`);
        const temp = await res.arrayBuffer();
        const trust = await this.verifyJWT(
          new TextDecoder().decode(new Uint8Array(temp)),
        );
        if (
          trust &&
          trust.hash ===
            toBase64(sha256(new TextEncoder().encode(payloadJson.data)))
        ) {
          return this.verifyJWT(payloadJson.data);
        }
        throw new Error('Invalid trust');
      } else {
        let publicKeys: string[] = [];

        if (
          payloadJson.iss.startsWith('http://') ||
          payloadJson.iss.startsWith('https://')
        ) {
          publicKeys = await this.fetchPublicKeyFromIssuer(payloadJson.iss);
        } else {
          publicKeys.push(payloadJson.iss);
        }

        const dataToSign = new TextEncoder().encode(`${header}.${payload}`);
        const recoveredPublicKey = await verifyPersonalMessageSignature(
          dataToSign,
          signature,
        );

        if (publicKeys.includes(recoveredPublicKey.toSuiPublicKey())) {
          return { ...payloadJson.data };
        }
        throw new Error('Invalid signature');
      }
    } catch (error) {
      throw new Error('Invalid signature');
    }
  }
}
