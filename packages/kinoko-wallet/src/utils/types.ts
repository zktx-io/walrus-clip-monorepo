export const ENOKI_URL = 'https://api.enoki.mystenlabs.com/v1';

export type NETWORK = 'mainnet' | 'testnet' | 'devnet';

export interface INonce {
  expiration: number;
  randomness: string;
  network: NETWORK;
  keypair: {
    publicKey: string;
    privateKey: {
      iv: string;
      encrypted: string;
    };
  };
}

export interface IAccount {
  nonce: INonce;
  zkAddress: {
    address: string;
    addressSeed: string;
    proof: string;
    jwt: string;
  };
}

export enum MessageType {
  STEP_0 = 'STEP_0',
  STEP_1 = 'STEP_1',
  STEP_2 = 'STEP_2',
}

export interface Message {
  type: MessageType;
  value: string;
}

export type NotiVariant = 'success' | 'warning' | 'info' | 'error';

export const makeMessage = (type: MessageType, value: string): string => {
  return JSON.stringify({ type, value });
};

export const parseMessage = (data: string): Message => {
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
