import type { NETWORK } from './walletTypes';

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
