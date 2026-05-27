import type {
  StandardConnectFeature,
  StandardConnectMethod,
  StandardDisconnectFeature,
  StandardDisconnectMethod,
  StandardEventsFeature,
  StandardEventsOnMethod,
  SuiFeatures,
  SuiSignAndExecuteTransactionMethod,
  SuiSignPersonalMessageMethod,
  SuiSignTransactionMethod,
} from '@mysten/wallet-standard';

export type WalletFeatureMethods = {
  connect: StandardConnectMethod;
  disconnect: StandardDisconnectMethod;
  on: StandardEventsOnMethod;
  signAndExecuteTransaction: SuiSignAndExecuteTransactionMethod;
  signPersonalMessage: SuiSignPersonalMessageMethod;
  signTransaction: SuiSignTransactionMethod;
};

export type WalrusWalletFeatures = StandardConnectFeature &
  StandardDisconnectFeature &
  StandardEventsFeature &
  Pick<
    SuiFeatures,
    | 'sui:signAndExecuteTransaction'
    | 'sui:signPersonalMessage'
    | 'sui:signTransaction'
  >;

export const createWalrusWalletFeatures = ({
  connect,
  disconnect,
  on,
  signAndExecuteTransaction,
  signPersonalMessage,
  signTransaction,
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
  'sui:signPersonalMessage': {
    version: '1.1.0',
    signPersonalMessage,
  },
  'sui:signTransaction': {
    version: '2.0.0',
    signTransaction,
  },
});

export const WALRUS_ACCOUNT_FEATURE_NAMES = [
  'sui:signAndExecuteTransaction',
  'sui:signPersonalMessage',
  'sui:signTransaction',
] as const;
