import { ENOKI_URL } from './types';

export const getEnokiSalt = async (
  key: string,
  jwt: string,
): Promise<{
  address: string;
  salt: string;
}> => {
  try {
    const res = await fetch(`${ENOKI_URL}/zklogin`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'zklogin-jwt': jwt,
      },
    });
    const { data } = (await res.json()) as {
      data: {
        address: string;
        salt: string;
      };
    };
    return data;
  } catch (error) {
    throw new Error(`${error}`);
  }
};
