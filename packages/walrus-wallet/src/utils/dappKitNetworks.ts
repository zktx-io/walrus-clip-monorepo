import { getFullnodeUrl } from '@mysten/sui/client';

export const createWalrusWalletDappKitNetworks = () => ({
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
  devnet: { url: getFullnodeUrl('devnet') },
});
