import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { toBase64 } from '@mysten/sui/utils';
import { generateNonce, generateRandomness } from '@mysten/sui/zklogin';

import { IZkLogin, NETWORK } from './types';
import { encryptText } from './utils';

export const createNonce = async (
  password: string,
  network: NETWORK,
  epochOffset?: number,
): Promise<{
  nonce: string;
  data: IZkLogin;
}> => {
  try {
    const suiClient = new SuiClient({ url: getFullnodeUrl(network) });
    const { epoch } = await suiClient.getLatestSuiSystemState();
    const expiration =
      Number(epoch) + (epochOffset ? Math.min(30, epochOffset) : 30);
    const ephemeralKeyPair = new Ed25519Keypair();
    const randomness = generateRandomness();
    const nonce = generateNonce(
      ephemeralKeyPair.getPublicKey(),
      expiration,
      randomness,
    );
    const { iv, encrypted, salt } = await encryptText(
      toBase64(decodeSuiPrivateKey(ephemeralKeyPair.getSecretKey()).secretKey),
      password,
    );
    return {
      nonce,
      data: {
        expiration,
        randomness,
        keypair: {
          publicKey: ephemeralKeyPair.getPublicKey().toBase64(),
          privateKey: {
            iv,
            encrypted,
            salt,
          },
        },
        proofInfo: {
          addressSeed: '',
          proof: '',
          jwt: '',
          iss: '',
        },
      },
    };
  } catch (error) {
    throw new Error(`${error}`);
  }
};
