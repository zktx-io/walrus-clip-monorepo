import {
  getJsonRpcFullnodeUrl,
  SuiJsonRpcClient,
} from '@mysten/sui/jsonRpc';
import type { NETWORK } from './walletTypes';

export type WalrusWalletSuiClient = SuiJsonRpcClient;

export const getWalrusWalletFullnodeUrl = (network: NETWORK) =>
  getJsonRpcFullnodeUrl(network);

export const createWalrusWalletSuiClient = (network: NETWORK) =>
  new SuiJsonRpcClient({
    network,
    url: getWalrusWalletFullnodeUrl(network),
  });
