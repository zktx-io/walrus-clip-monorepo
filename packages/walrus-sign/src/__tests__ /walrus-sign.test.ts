import { EncryptedObject, SessionKey, UserError } from '@mysten/seal';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHex, isValidSuiObjectId, toHex } from '@mysten/sui/utils';

import { WalrusSign } from '../index';

// https://github.com/MystenLabs/ts-sdks/blob/main/packages/seal/src/utils.ts
function createFullId(
  dst: Uint8Array,
  packageId: string,
  innerId: string,
): string {
  if (!isValidSuiObjectId(packageId)) {
    throw new UserError(`Invalid package ID ${packageId}`);
  }
  const packageIdBytes = fromHex(packageId);
  const innerIdBytes = fromHex(innerId);
  const fullId = new Uint8Array(
    1 + dst.length + packageIdBytes.length + innerIdBytes.length,
  );
  fullId.set([dst.length], 0);
  fullId.set(dst, 1);
  fullId.set(packageIdBytes, 1 + dst.length);
  fullId.set(innerIdBytes, 1 + dst.length + packageIdBytes.length);
  return toHex(fullId);
}

// https://github.com/MystenLabs/ts-sdks/blob/main/packages/seal/src/ibe.ts
const DST: Uint8Array = new TextEncoder().encode('SUI-SEAL-IBE-BLS12381-00');

// Mock signer setup
const issuerKeypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(0));
const holderKeypair = Ed25519Keypair.fromSecretKey(new Uint8Array(32).fill(1));
const verifierKeypair = Ed25519Keypair.fromSecretKey(
  new Uint8Array(32).fill(2),
);

const walrusSign = new WalrusSign(issuerKeypair, 'testnet');
const allowlistId = '0x1234567890123456789012345678901234567890';

let jwt: string;

//
// ======================
// Issuer
// ======================
//

describe('Issuer Role', () => {
  it('should sign a JWT', async () => {
    const payload = { role: 'member' };
    const expire = Date.now() + 3600 * 1000;
    jwt = await walrusSign.signJWT(
      holderKeypair.getPublicKey().toSuiAddress(),
      expire,
      allowlistId,
      payload,
    );
    expect(jwt).toBeDefined();
  });

  it('should verify the signed JWT', async () => {
    const verified = await walrusSign.verifyJWT(jwt);
    expect(verified).toBeDefined();
    expect(verified!.role).toBe('member');
  });
});

//
// ======================
// Holder
// ======================
//

describe('Holder Role', () => {
  it('should encrypt the JWT with Seal', async () => {
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(5)));
    const sealed = await walrusSign.createSealedJWT(jwt, nonce);

    // Basic checks
    expect(sealed).toBeInstanceOf(Uint8Array);
    expect(sealed.length).toBeGreaterThan(0);

    // Parse the sealed data
    const parsed = EncryptedObject.parse(sealed);

    // Check the structure
    expect(parsed.version).toEqual(0);
    expect(parsed.id).toEqual(`${allowlistId.replace('0x', '')}${nonce}`);
    expect(parsed.threshold).toBeGreaterThan(0);
    expect(parsed.services.length).toBeGreaterThan(0);
    expect(parsed.packageId).toBeDefined();

    // Optional: Validate id derivation
    const fullId = createFullId(DST, parsed.packageId, parsed.id);
    expect(fromHex(fullId)).toBeInstanceOf(Uint8Array);
  });
});

//
// ======================
// Verifier
// ======================
//
/*
describe('Verifier Role', () => {
  it('should decrypt and verify the JWT', async () => {
    const nonce = toHex(crypto.getRandomValues(new Uint8Array(5)));
    const sealed = await walrusSign.createSealedJWT(jwt, nonce);
    const fakeSessionKey = {} as SessionKey;
    const txBytes = new Uint8Array();

    const decrypted = await walrusSign.decryptWithSeal(
      sealed,
      fakeSessionKey,
      txBytes,
    );

    expect(decrypted).not.toEqual(sealed);
    expect(new TextDecoder().decode(decrypted)).toEqual(jwt);

    const verified = await walrusSign.verifyJWT(
      new TextDecoder().decode(decrypted),
    );
    expect(verified).toBeDefined();
    expect(verified!.role).toBe('member');
  });
});
*/
