import { NETWORK } from '@zktx.io/walrus-connect';

export const ENOKI_URL = 'https://api.enoki.mystenlabs.com/v1';

export interface IZkLogin {
  expiration: number;
  randomness: string;
  keypair: {
    publicKey: string;
    privateKey: {
      iv: string;
      encrypted: string;
      salt: string;
    };
  };
  proofInfo: {
    addressSeed: string;
    proof: string;
    iss: string;
    jwt: string;
  };
}

export interface IAccount {
  network: NETWORK;
  address: string;
  zkLogin?: IZkLogin;
}

export const makeMessage = (type: string, value: string): string => {
  return JSON.stringify({ type, value });
};

export const parseMessage = (data: string): { type: string; value: string } => {
  try {
    const message = JSON.parse(data);
    if (!message.type || !message.value) {
      throw new Error('Invalid message structure');
    }
    return message;
  } catch (error) {
    throw new Error(`Failed to parse message: ${error}`);
  }
};
