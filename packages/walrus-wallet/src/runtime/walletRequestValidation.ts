import type {
  ReadonlyWalletAccount,
  SuiSignPersonalMessageInput,
  SuiSignTransactionInput,
} from '@mysten/wallet-standard';
import type { NETWORK } from '../utils/walletTypes';

import {
  WalrusWalletAccountMismatchError,
  WalrusWalletChainMismatchError,
} from './walletErrors';

type WalletRequestAccount =
  | SuiSignTransactionInput['account']
  | SuiSignPersonalMessageInput['account']
  | undefined;

export const assertWalletRequestAccount = ({
  activeAccount,
  requestedAccount,
}: {
  activeAccount: ReadonlyWalletAccount | undefined;
  requestedAccount: WalletRequestAccount;
}) => {
  const expected = activeAccount?.address ?? '<no active account>';
  const received = requestedAccount?.address ?? '<missing>';

  if (!activeAccount || !requestedAccount || activeAccount.address !== requestedAccount.address) {
    throw new WalrusWalletAccountMismatchError({ expected, received });
  }
};

export const assertWalletRequestChain = ({
  network,
  chain,
  required = true,
}: {
  network: NETWORK;
  chain?: string;
  required?: boolean;
}) => {
  if (!chain && !required) return;

  const expected = `sui:${network}`;
  if (chain !== expected) {
    throw new WalrusWalletChainMismatchError({
      expected,
      received: chain ?? '<missing>',
    });
  }
};
