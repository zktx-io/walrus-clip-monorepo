import { getAllowlistedKeyServers, SealClient, SessionKey } from '@mysten/seal';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Signer } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, fromHex, toBase64, toHex } from '@mysten/sui/utils';
import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { poseidonHash } from '@mysten/sui/zklogin';

import { Aggregator, Network, PackageId } from './config';

interface VrificationPayload {
  sub: string;
  hash: string;
  allowlist: string;
  iat: number;
  exp: number;
  iss: string;
}

const BN254_PRIME = BigInt(
  '21888242871839275222246405745257275088548364400416034343698204186575808495617',
);

// utils
const jsonToBase64Url = (json: { [key: string]: any }): string => {
  return toBase64(new TextEncoder().encode(JSON.stringify(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

const base64UrlToBase64 = (url: string) =>
  url.replace(/-/g, '+').replace(/_/g, '/');

const textToBigInt = (text: string) => {
  const hex = Array.from(new TextEncoder().encode(text))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return BigInt('0x' + hex) % BN254_PRIME;
};

const bigIntToBase64 = (num: bigint) => {
  let hex = num.toString(16);
  if (hex.length % 2 !== 0) hex = '0' + hex;
  const bytes = new Uint8Array(
    hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  return toBase64(bytes);
};

// core class
export class WalrusSign {
  private readonly signer: Signer;
  private readonly issuer: string;
  private network: Network;
  private suiClient: SuiClient;
  private sealClient: SealClient;

  constructor(signer: Signer, network: Network, issuer?: string) {
    this.signer = signer;
    this.network = network;
    this.issuer = issuer ?? signer.getPublicKey().toSuiPublicKey();
    this.suiClient = new SuiClient({ url: getFullnodeUrl(network) });
    this.sealClient = new SealClient({
      suiClient: this.suiClient,
      serverObjectIds: getAllowlistedKeyServers(network),
      verifyKeyServers: false,
    });
  }

  //////////////////////////////////
  // === ISSUER ===

  // 1. Create and sign a JWT
  async signJWT(
    subject: string,
    expire: number,
    allowlistId: string,
    payload: { [x: string]: any },
    audience?: string | string[],
  ): Promise<string> {
    const header = { alg: this.signer.getKeyScheme(), typ: 'SUI' };
    const jwtPayload = {
      ...payload,
      allowlist: allowlistId,
      iss: this.issuer,
      sub: subject,
      exp: Math.floor(expire / 1000),
      iat: Math.floor(Date.now() / 1000),
      ...(audience ? { aud: audience } : {}),
    };
    const encodedHeader = jsonToBase64Url(header);
    const encodedPayload = jsonToBase64Url({ data: jwtPayload });
    const dataToSign = new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`,
    );
    const { signature } = await this.signer.signPersonalMessage(dataToSign);
    return `${encodedHeader}.${encodedPayload}.${signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  }

  // 2. (TODO) Create trust by storing hash of JWT in Walrus (not implemented)
  async createTrust(token: string, expire: number): Promise<string> {
    throw new Error('createTrust not implemented yet');
  }

  // 3. Create a verifier group
  async createVerifierGroup(groupName: string): Promise<boolean> {
    const transaction = new Transaction();
    transaction.setSenderIfNotSet(this.signer.getPublicKey().toSuiPublicKey());
    transaction.setGasBudgetIfNotSet(10000000);
    transaction.moveCall({
      target: `${PackageId}::verifier_group::create_entry`,
      arguments: [transaction.pure.string(groupName)],
    });
    const { digest } = await this.suiClient.signAndExecuteTransaction({
      transaction,
      signer: this.signer,
    });
    const { effects } = await this.suiClient.waitForTransaction({
      digest,
      options: { showEffects: true },
    });
    if (effects!.status.status !== 'success') {
      return true;
    } else {
      return false;
    }
  }

  // 3. Register verifier address to allowlist
  async registerVerifier(
    groupId: string,
    capId: string,
    verifierAddress: string,
  ): Promise<boolean> {
    const transaction = new Transaction();
    transaction.setSenderIfNotSet(this.signer.getPublicKey().toSuiPublicKey());
    transaction.setGasBudgetIfNotSet(10000000);
    transaction.moveCall({
      target: `${PackageId}::verifier_group::add_verifier`,
      arguments: [
        transaction.object(groupId),
        transaction.object(capId),
        transaction.pure.address(verifierAddress),
      ],
    });
    const { digest } = await this.suiClient.signAndExecuteTransaction({
      transaction,
      signer: this.signer,
    });
    const { effects } = await this.suiClient.waitForTransaction({
      digest,
      options: { showEffects: true },
    });
    if (effects!.status.status !== 'success') {
      return true;
    } else {
      return false;
    }
  }

  // 4. Revoke verifier address from allowlist
  async revokeVerifier(
    groupId: string,
    capId: string,
    verifierAddress: string,
  ): Promise<boolean> {
    const transaction = new Transaction();
    transaction.setSenderIfNotSet(this.signer.getPublicKey().toSuiPublicKey());
    transaction.setGasBudgetIfNotSet(10000000);
    transaction.moveCall({
      target: `${PackageId}::verifier_group::remove_verifier`,
      arguments: [
        transaction.object(groupId),
        transaction.object(capId),
        transaction.pure.address(verifierAddress),
      ],
    });
    const { digest } = await this.suiClient.signAndExecuteTransaction({
      transaction,
      signer: this.signer,
    });
    const { effects } = await this.suiClient.waitForTransaction({
      digest,
      options: { showEffects: true },
    });
    if (effects!.status.status !== 'success') {
      return true;
    } else {
      return false;
    }
  }

  //////////////////////////////////
  // === HOLDER ===

  // 1. Encrypt the JWT using Seal
  async createSealedJWT(jwt: string, nonce?: string): Promise<Uint8Array> {
    const [headerB64, payloadB64] = jwt.split('.');
    const payloadJson = JSON.parse(
      new TextDecoder().decode(fromBase64(payloadB64)),
    );

    let policyObjectId: string;
    let prefix: number;

    if ('data' in payloadJson) {
      policyObjectId = payloadJson.data.allowlist;
      prefix = 0x00; // Original JWT
    } else if ('proof' in payloadJson) {
      policyObjectId = payloadJson.proof.allowlist;
      prefix = 0x01; // Proof JWT
    } else {
      throw new Error('Invalid JWT structure: missing data or proof');
    }

    const id = toHex(
      new Uint8Array([
        ...fromHex(policyObjectId),
        ...(nonce ? fromHex(nonce) : crypto.getRandomValues(new Uint8Array(5))),
      ]),
    );

    const { encryptedObject } = await this.sealClient.encrypt({
      threshold: 2,
      packageId: PackageId,
      id,
      data: new TextEncoder().encode(jwt),
    });

    return new Uint8Array([prefix, ...encryptedObject]);
  }

  //////////////////////////////////
  // === VERIFIER ===

  // 1. Decrypt a sealed JWT (OriginalJWT or ProofJWT)
  async decryptWithSeal(
    encrypted: Uint8Array,
    sessionKey: SessionKey,
    txBytes: Uint8Array,
  ): Promise<{ type: 'sealed' | 'proof'; payload: Uint8Array }> {
    if (encrypted.length < 2) {
      throw new Error('Invalid encrypted payload: too short');
    }

    const prefix = encrypted[0];
    const encryptedPayload = encrypted.slice(1);

    const decrypted = await this.sealClient.decrypt({
      data: encryptedPayload,
      sessionKey,
      txBytes,
    });

    let type: 'sealed' | 'proof';
    if (prefix === 0x00) {
      type = 'sealed';
    } else if (prefix === 0x01) {
      type = 'proof';
    } else {
      throw new Error(`Unknown prefix type: ${prefix}`);
    }

    return {
      type,
      payload: decrypted,
    };
  }

  // 2. Verify a JWT (OriginalJWT or ProofJWT)
  async verifyJWT(token: string): Promise<{ [x: string]: any } | undefined> {
    try {
      const [headerB64, payloadB64, signature] = token.split('.');
      const headerJson = JSON.parse(
        new TextDecoder().decode(fromBase64(headerB64)),
      );
      if (headerJson.typ === 'JWT') throw new Error('Invalid token type');

      const payloadJson = JSON.parse(
        new TextDecoder().decode(fromBase64(payloadB64)),
      );

      const dataToSign = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
      const recoveredPublicKey = await verifyPersonalMessageSignature(
        dataToSign,
        base64UrlToBase64(signature),
      );

      // ProofJWT
      if ('proof' in payloadJson) {
        const proof = payloadJson.proof;

        if (recoveredPublicKey.toSuiPublicKey() !== proof.iss) {
          throw new Error('Invalid verifier signature');
        }

        const now = Math.floor(Date.now() / 1000);
        if (proof.exp <= now) {
          throw new Error('Proof has expired');
        }

        return { ...proof };
      }

      // OriginalJWT
      else if ('data' in payloadJson) {
        if (recoveredPublicKey.toSuiPublicKey() !== this.issuer) {
          throw new Error('Invalid issuer signature');
        }

        return { ...payloadJson.data };
      } else {
        throw new Error('Invalid JWT structure');
      }
    } catch (e) {
      throw new Error(
        `Invalid signature (general failure): ${(e as Error).message}`,
      );
    }
  }

  // 3. Issue a minimal verification certificate (signed)
  async issueVerificationCertificate(
    originalJwt: string,
    validityPeriodMs: number = 3600 * 1000, // 1 hour
  ): Promise<string> {
    // Step 1: Parse original JWT
    const [headerB64, payloadB64] = originalJwt.split('.');
    const payloadJson = JSON.parse(
      new TextDecoder().decode(fromBase64(payloadB64)),
    );
    const subject = payloadJson.data.sub as string;
    if (!subject) {
      throw new Error('Invalid original JWT: missing subject');
    }

    // Step 2: Hash the original JWT (header.payload)
    const hashInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const hashBigInt = poseidonHash([textToBigInt(toBase64(hashInput))]);
    const hashBase64 = bigIntToBase64(hashBigInt);

    // Step 3: Create minimal proof payload
    const now = Math.floor(Date.now() / 1000);
    const expire = Math.floor((Date.now() + validityPeriodMs) / 1000);

    const verificationPayload: VrificationPayload = {
      sub: subject,
      hash: hashBase64,
      allowlist: payloadJson.data.allowlist,
      iat: now,
      exp: expire,
      iss: this.signer.getPublicKey().toSuiPublicKey(), // Verifier address
    };

    const header = { alg: this.signer.getKeyScheme(), typ: 'SUI' };
    const encodedHeader = jsonToBase64Url(header);
    const encodedPayload = jsonToBase64Url({ proof: verificationPayload });

    const dataToSign = new TextEncoder().encode(
      `${encodedHeader}.${encodedPayload}`,
    );
    const { signature } = await this.signer.signPersonalMessage(dataToSign);

    return `${encodedHeader}.${encodedPayload}.${signature
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')}`;
  }
}
