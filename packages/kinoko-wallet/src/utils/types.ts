export const ENOKI_URL = 'https://api.enoki.mystenlabs.com/v1';

export type NETWORK = 'mainnet' | 'testnet' | 'devnet';

export interface IZkLogin {
  expiration: number;
  randomness: string;
  keypair: {
    publicKey: string;
    privateKey: {
      iv: string;
      encrypted: string;
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
