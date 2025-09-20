import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import {
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from '@mysten/sui/zklogin';
import { NETWORK } from '@zktx.io/walrus-connect';

import { getEnokiSalt } from './getEnokiSalt';
import { ENOKI_URL, IZkLogin } from './types';

const getProverUrl = (network: NETWORK): string => {
  switch (network) {
    case 'devnet':
      return 'https://prover-dev.mystenlabs.com/v1';
    default:
      return 'https://prover.mystenlabs.com/v1';
  }
};

export const createProof = async (
  key: string,
  network: NETWORK,
  { expiration, randomness, keypair }: IZkLogin,
  jwt: string,
): Promise<{ address: string; proof: string; salt: string }> => {
  try {
    const enoki = await getEnokiSalt(key, jwt);

    if (network === 'testnet') {
      const res = await fetch(`${ENOKI_URL}/zklogin/zkp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          'zklogin-jwt': jwt,
        },
        body: JSON.stringify({
          network: network,
          randomness: randomness,
          maxEpoch: expiration,
          ephemeralPublicKey: getExtendedEphemeralPublicKey(
            new Ed25519PublicKey(fromBase64(keypair.publicKey)),
          ),
        }),
      });

      const { data, errors } = await res.json();

      if (!data) {
        throw new Error(`${errors}`);
      }

      return {
        address: enoki.address,
        proof: JSON.stringify(data),
        salt: enoki.salt,
      };
    }

    const address = jwtToAddress(jwt, BigInt(enoki.salt));
    const res = await fetch(getProverUrl(network), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jwt,
        extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
          new Ed25519PublicKey(fromBase64(keypair.publicKey)),
        ),
        maxEpoch: expiration,
        jwtRandomness: randomness,
        salt: enoki.salt,
        keyClaimName: 'sub',
      }),
    });

    if (res.ok) {
      const data = await res.json();
      return { address, proof: JSON.stringify(data), salt: enoki.salt };
    } else {
      throw new Error('Login Fail - create proof error');
    }
  } catch (error) {
    throw new Error(`${error}`);
  }
};
