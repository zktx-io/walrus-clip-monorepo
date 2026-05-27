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
  signTransaction: SuiSignTransactionMethod;
  signPersonalMessage: SuiSignPersonalMessageMethod;
};

export type WalrusWalletFeatures = StandardConnectFeature &
  StandardDisconnectFeature &
  StandardEventsFeature &
  Pick<
    SuiFeatures,
    | 'sui:signAndExecuteTransaction'
    | 'sui:signTransaction'
    | 'sui:signPersonalMessage'
  >;

export const createWalrusWalletFeatures = ({
  connect,
  disconnect,
  on,
  signAndExecuteTransaction,
  signTransaction,
  signPersonalMessage,
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
  'sui:signTransaction': {
    version: '2.0.0',
    signTransaction,
  },
  'sui:signPersonalMessage': {
    version: '1.1.0',
    signPersonalMessage,
  },
});

export const createWalrusAccountFeatureNames = (hasLocalSigner: boolean) =>
  hasLocalSigner
    ? ([
        'sui:signTransaction',
        'sui:signAndExecuteTransaction',
        'sui:signPersonalMessage',
      ] as const)
    : (['sui:signAndExecuteTransaction'] as const);
