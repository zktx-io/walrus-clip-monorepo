import { toBase64 } from '@mysten/sui/utils';
import type {
  ReadonlyWalletAccount,
  SignedTransaction,
  SuiSignAndExecuteTransactionInput,
  SuiSignAndExecuteTransactionOutput,
  SuiSignPersonalMessageInput,
  SuiSignPersonalMessageOutput,
  SuiSignTransactionInput,
} from '@mysten/wallet-standard';
import type { NETWORK } from '../utils/walletTypes';

import {
  signAndExecuteTransactionWithLocalSigner,
  signAndExecuteTransactionWithQrRoute,
  signTransactionWithLocalSigner,
  type WalletQrSignModal,
} from './signingRoutes';
import { WalrusWalletFeatureUnavailableError } from './walletErrors';
import {
  assertWalletRequestAccount,
  assertWalletRequestChain,
} from './walletRequestValidation';
import type { ZkLoginSigner } from '../utils/zkLoginSigner';

export type WalletSigningRuntimeConfig = {
  network: NETWORK;
  sponsoredUrl?: string;
  signer?: ZkLoginSigner;
  activeAccount?: ReadonlyWalletAccount;
  openSignTxModal: WalletQrSignModal;
};

export const signWalletTransaction = async (
  config: WalletSigningRuntimeConfig,
  { transaction, account, chain }: SuiSignTransactionInput,
): Promise<SignedTransaction> => {
  assertWalletRequestAccount({
    activeAccount: config.activeAccount,
    requestedAccount: account,
  });
  assertWalletRequestChain({ network: config.network, chain });

  if (config.signer) {
    return signTransactionWithLocalSigner({
      signer: config.signer,
      network: config.network,
      transaction,
    });
  }

  throw new WalrusWalletFeatureUnavailableError({
    feature: 'sui:signTransaction',
    route: 'qr',
    reason:
      'sui:signTransaction is unavailable in QR-only mode. Use sui:signAndExecuteTransaction for the QR signing route.',
  });
};

export const signAndExecuteWalletTransaction = async (
  config: WalletSigningRuntimeConfig,
  { transaction, account, chain }: SuiSignAndExecuteTransactionInput,
): Promise<SuiSignAndExecuteTransactionOutput> => {
  assertWalletRequestAccount({
    activeAccount: config.activeAccount,
    requestedAccount: account,
  });
  assertWalletRequestChain({ network: config.network, chain });

  if (config.signer) {
    return signAndExecuteTransactionWithLocalSigner({
      signer: config.signer,
      network: config.network,
      transaction,
      sponsoredUrl: config.sponsoredUrl,
    });
  }

  return signAndExecuteTransactionWithQrRoute({
    openSignTxModal: config.openSignTxModal,
    transaction,
    sponsoredUrl: config.sponsoredUrl,
  });
};

export const signWalletPersonalMessage = async (
  config: WalletSigningRuntimeConfig,
  { message, account, chain }: SuiSignPersonalMessageInput,
): Promise<SuiSignPersonalMessageOutput> => {
  assertWalletRequestAccount({
    activeAccount: config.activeAccount,
    requestedAccount: account,
  });
  assertWalletRequestChain({
    network: config.network,
    chain,
    required: false,
  });

  if (config.signer) {
    const { signature } = await config.signer.signPersonalMessage(message);
    return {
      bytes: toBase64(message),
      signature,
    };
  }

  throw new WalrusWalletFeatureUnavailableError({
    feature: 'sui:signPersonalMessage',
    route: 'qr',
    reason: 'signPersonalMessage is unavailable in QR-only mode.',
  });
};
