import { toBase64 } from '@mysten/sui/utils';

import { NETWORK } from '../types';

const DEFAULT_TIMEOUT_MS = 10000;

export const createSponsoredTransaction = async (
  url: string,
  network: NETWORK,
  address: string,
  txBytes: Uint8Array,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ bytes: string; digest: string }> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
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
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorBody = await res.json();
        if (errorBody.error) errorMessage = errorBody.error;
        else if (errorBody.message) errorMessage = errorBody.message;
      } catch {
        // Failed to parse error response, use status text
      }
      throw new Error(
        `Failed to create sponsored transaction: ${errorMessage}`,
      );
    }

    const json = await res.json();
    if (!json.bytes || !json.digest) {
      throw new Error(
        'Invalid response from sponsor server: missing bytes or digest',
      );
    }
    return { bytes: json.bytes, digest: json.digest };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Sponsored transaction creation timed out after ${timeoutMs}ms`,
      );
    }
    throw error;
  }
};

export const executeSponsoredTransaction = async (
  url: string,
  digest: string,
  signature: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${url}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        digest,
        signature,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
      try {
        const errorBody = await res.json();
        if (errorBody.error) errorMessage = errorBody.error;
        else if (errorBody.message) errorMessage = errorBody.message;
      } catch {
        // Failed to parse error response, use status text
      }
      throw new Error(
        `Failed to execute sponsored transaction: ${errorMessage}`,
      );
    }
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Sponsored transaction execution timed out after ${timeoutMs}ms`,
      );
    }
    throw error;
  }
};
