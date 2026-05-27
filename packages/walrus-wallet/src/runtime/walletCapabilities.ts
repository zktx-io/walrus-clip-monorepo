import type {
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  StandardEventsOnMethod,
  SuiFeatures,
  SuiSignAndExecuteTransactionMethod,
} from '@mysten/wallet-standard';

export type WalletFeatureMethods = {
  connect: StandardConnectMethod;
  disconnect: StandardDisconnectMethod;
  on: StandardEventsOnMethod;
  signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod;
};

export type WalrusWalletFeatures = StandardConnectFeature &
  StandardDisconnectFeature &
  StandardEventsFeature &
  Pick<SuiFeatures, 'sui:signAndExecuteTransaction'>;

export const createWalrusWalletFeatures = ({
  connect,
  disconnect,
  on,
  signAndExecuteTransaction,
}: WalletFeatureMethods): WalrusWalletFeatures => ({
  'standard:connect': {
    version: '1.0.0',
    connect,
  },
  'standard:events': {
    version: '1.0.0',
    on,
  },
  'standard:disconnect': {
    version: '1.0.0',
    disconnect,
  },
  'sui:signAndExecuteTransaction': {
    version: '2.0.0',
    signAndExecuteTransaction,
  },
});

export const WALRUS_ACCOUNT_FEATURE_NAMES = [
  'sui:signAndExecuteTransaction',
] as const;
