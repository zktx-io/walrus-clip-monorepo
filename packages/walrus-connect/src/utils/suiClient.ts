import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SuiGraphQLClient } from '@mysten/sui/graphql';

import type { NETWORK } from '../types';

export const createWalrusConnectSuiClient = (network: NETWORK) =>
  new SuiClient({ url: getFullnodeUrl(network) });

export const createWalrusConnectGraphQLClient = (network: NETWORK) =>
  new SuiGraphQLClient({
    url: `https://sui-${network}.mystenlabs.com/graphql`,
  });
