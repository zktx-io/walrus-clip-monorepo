import { toBase64 } from '@mysten/sui/utils';

import { NETWORK } from '../types';

export const createSponsoredTransaction = async (
  url: string,
  network: NETWORK,
  address: string,
  txBytes: Uint8Array,
): Promise<{ bytes: string; digest: string }> => {
  const res = await fetch(`${url}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address,
      network,
      transactionBlockKindBytes: toBase64(txBytes),
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to create sponsored transaction');
  }
  const { bytes, digest } = await res.json();
  return {
    bytes,
    digest,
  };
};

export const executeSponsoredTransaction = async (
  url: string,
  digest: string,
  signature: string,
) => {
  const res = await fetch(`${url}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      digest,
      signature,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to execute sponsored transaction');
  }
};
