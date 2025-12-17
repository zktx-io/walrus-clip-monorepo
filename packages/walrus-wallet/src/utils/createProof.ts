import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import {
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from '@mysten/sui/zklogin';
import { NETWORK } from '@zktx.io/walrus-connect';

import { getEnokiSalt } from './getEnokiSalt';
import { ENOKI_URL, IZkLogin } from './types';

const DEFAULT_TIMEOUT_MS = 10000;

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
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ address: string; proof: string; salt: string }> => {
  const enoki = await getEnokiSalt(key, jwt, timeoutMs);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(
          `Failed to create zkLogin proof: HTTP ${res.status} ${res.statusText}`,
        );
      }

      const { data, errors } = await res.json();

      if (!data) {
        throw new Error(
          `Failed to create zkLogin proof: ${errors || 'Unknown error'}`,
        );
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
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorBody = await res.json();
        if (errorBody.error) {
          errorMessage = errorBody.error;
        } else if (errorBody.message) {
          errorMessage = errorBody.message;
        }
      } catch {
        // Failed to parse error response, use status text
      }
      throw new Error(`Failed to create zkLogin proof: ${errorMessage}`);
    }

    const data = await res.json();
    return { address, proof: JSON.stringify(data), salt: enoki.salt };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`zkLogin proof creation timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
};
