import type {
  ReadonlyWalletAccount,
  SuiSignAndExecuteTransactionInput,
  SuiSignAndExecuteTransactionOutput,
  SuiSignPersonalMessageInput,
  SuiSignPersonalMessageOutput,
  SuiSignTransactionInput,
  SignedTransaction,
} from '@mysten/wallet-standard';
import type { NETWORK } from '../utils/walletTypes';

import {
  signPersonalMessageWithQrRoute,
  signTransactionWithQrRoute,
  signAndExecuteTransactionWithQrRoute,
  type WalletQrSignModal,
} from './signingRoutes';
import {
  assertWalletRequestAccount,
  assertWalletRequestChain,
} from './walletRequestValidation';

export type WalletSigningRuntimeConfig = {
  network: NETWORK;
  activeAccount?: ReadonlyWalletAccount;
  openSignTxModal: WalletQrSignModal;
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

  return signAndExecuteTransactionWithQrRoute({
    openSignTxModal: config.openSignTxModal,
    transaction,
  });
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

  return signTransactionWithQrRoute({
    openSignTxModal: config.openSignTxModal,
    transaction,
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
  assertWalletRequestChain({ network: config.network, chain, required: false });

  return signPersonalMessageWithQrRoute({
    openSignTxModal: config.openSignTxModal,
    message,
  });
};
