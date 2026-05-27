import { SuiGrpcClient } from '@mysten/sui/grpc';
import type { NETWORK } from './walletTypes';

export type WalrusWalletSuiClient = SuiGrpcClient;

// SDK README documents these as the gRPC-Web baseUrls.
// `.WORK/ts-sdks/packages/sui/README.md:75-81`.
const WALRUS_WALLET_GRPC_BASE_URLS: Record<NETWORK, string> = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

export const getWalrusWalletGrpcBaseUrl = (network: NETWORK) =>
  WALRUS_WALLET_GRPC_BASE_URLS[network];

export const createWalrusWalletSuiClient = (network: NETWORK) =>
  new SuiGrpcClient({
    network,
    baseUrl: getWalrusWalletGrpcBaseUrl(network),
  });
