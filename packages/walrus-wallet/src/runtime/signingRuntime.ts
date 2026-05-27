import type {
  ReadonlyWalletAccount,
  SuiSignAndExecuteTransactionInput,
  SuiSignAndExecuteTransactionOutput,
} from '@mysten/wallet-standard';
import type { NETWORK } from '../utils/walletTypes';

import {
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
