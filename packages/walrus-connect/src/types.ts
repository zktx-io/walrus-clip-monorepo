import { PublicKey } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
import {
  SignedTransaction,
  SuiSignPersonalMessageOutput,
} from '@mysten/wallet-standard';

export type NETWORK = 'mainnet' | 'testnet' | 'devnet';
export type NotiVariant = 'success' | 'warning' | 'info' | 'error';
export type QRScanType = 'login' | 'sign' | 'verification';

export interface ClipSigner {
  getAddress: () => string;
  getPublicKey: () => PublicKey;
  signTransaction: (transaction: Transaction) => Promise<SignedTransaction>;
  signPersonalMessage: (
    message: Uint8Array,
  ) => Promise<SuiSignPersonalMessageOutput>;
}
