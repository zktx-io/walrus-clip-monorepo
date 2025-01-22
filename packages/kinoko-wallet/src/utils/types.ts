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
