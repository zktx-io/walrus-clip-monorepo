import { ENOKI_URL } from './types';

const DEFAULT_TIMEOUT_MS = 10000;

export const getEnokiSalt = async (
  key: string,
  jwt: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{
  address: string;
  salt: string;
}> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${ENOKI_URL}/zklogin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'zklogin-jwt': jwt,
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(
        `Failed to fetch Enoki salt: HTTP ${res.status} ${res.statusText}`,
      );
    }

    const { data } = (await res.json()) as {
      data?: {
        address: string;
        salt: string;
      };
    };

    if (!data || !data.address || !data.salt) {
      throw new Error('Invalid response from Enoki: missing address or salt');
    }

    return data;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Enoki salt request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
};
