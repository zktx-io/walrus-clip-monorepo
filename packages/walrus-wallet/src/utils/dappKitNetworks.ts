import { createWalrusWalletDappKitNetworkConfig } from './suiClient';

export const createWalrusWalletDappKitNetworks = () => ({
  mainnet: createWalrusWalletDappKitNetworkConfig('mainnet'),
  testnet: createWalrusWalletDappKitNetworkConfig('testnet'),
  devnet: createWalrusWalletDappKitNetworkConfig('devnet'),
});
