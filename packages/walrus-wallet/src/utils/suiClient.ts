import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import type { NETWORK } from './walletTypes';

export const createWalrusWalletSuiClient = (network: NETWORK) =>
  new SuiClient({ url: getFullnodeUrl(network) });
