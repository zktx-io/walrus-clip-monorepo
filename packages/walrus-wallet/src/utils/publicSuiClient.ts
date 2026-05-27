import type { SuiGrpcClient } from '@mysten/sui/grpc';

import { createWalrusWalletSuiClient as createInternal } from './suiClient';
import type { NETWORK } from './walletTypes';

export const createWalrusWalletSuiClient = (
  network: NETWORK,
): SuiGrpcClient => createInternal(network);
