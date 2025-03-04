import { jest } from '@jest/globals';
import {
  IntentScope,
  PublicKey,
  SignatureScheme,
  SignatureWithBytes,
  Signer,
} from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';

import { WalrusSign } from '../index';

// Mock Signer
class MockSigner implements Signer {
  private signer: Ed25519Keypair;
  constructor(signer: Ed25519Keypair) {
    this.signer = signer;
  }
  sign(bytes: Uint8Array): Promise<Uint8Array> {
    return this.signer.sign(bytes);
  }
  signWithIntent(
    bytes: Uint8Array,
    intent: IntentScope,
  ): Promise<SignatureWithBytes> {
    throw new Error('Method not implemented.');
  }
  signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    throw new Error('Method not implemented.');
  }
  toSuiAddress(): string {
    throw new Error('Method not implemented.');
  }
  getKeyScheme(): SignatureScheme {
    return 'ED25519';
  }

  async signPersonalMessage(
    data: Uint8Array,
  ): Promise<{ bytes: string; signature: string }> {
    const { signature } = await this.signer.signPersonalMessage(data);
    return {
      bytes: toBase64(data),
      signature,
    };
  }

  getPublicKey(): PublicKey {
    return this.getPublicKey();
  }
}

const keypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(1));

const mockNetwork = 'TestNetwork' as any;
const mockIssuer = keypair.getPublicKey().toSuiPublicKey();
const mockSigner = new MockSigner(keypair);

const walrusSign = new WalrusSign(mockSigner, mockNetwork, mockIssuer);

describe('WalrusSign Tests', () => {
  let token: string;

  beforeAll(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            newlyCreated: { blobObject: { blobId: 'mockBlobIdBase64' } },
          }),
      } as Response),
    ) as jest.MockedFunction<typeof fetch>;
  });

  test('signJWT should create a valid JWT', async () => {
    const payload = { role: 'admin' };
    const expire = Date.now() + 3600 * 1000;

    token = await walrusSign.signJWT('user123', expire, payload);
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
  });

  test('verifyJWT should validate signed JWT', async () => {
    const verifiedPayload = await walrusSign.verifyJWT(token);
    expect(verifiedPayload).toBeDefined();
    expect(verifiedPayload!.role).toBe('admin');
  });

  test('createTrust should return a signed trust JWT', async () => {
    const trustToken = await walrusSign.createTrust(
      token,
      Date.now() + 3600 * 1000,
    );
    expect(trustToken).toBeDefined();
    expect(trustToken.split('.')).toHaveLength(3);
  });
});
