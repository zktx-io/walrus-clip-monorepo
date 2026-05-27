import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

import { createWalrusWalletSuiClient as createInternal } from './suiClient';
import type { NETWORK } from './walletTypes';

export const createWalrusWalletSuiClient = (
  network: NETWORK,
): SuiJsonRpcClient => createInternal(network);
