import { PublicKey } from '@mysten/sui/cryptography';
import { Transaction } from '@mysten/sui/transactions';
import {
  SignedTransaction,
  SuiSignPersonalMessageOutput,
} from '@mysten/wallet-standard';

export type NETWORK = 'mainnet' | 'testnet' | 'devnet';
export type NotiVariant = 'success' | 'warning' | 'info' | 'error';
export type QRScanType = 'login' | 'sign' | 'verification';

export type SignTransactionReviewFact = {
  label: string;
  value: string;
};

export type SignTransactionReviewInput = {
  index: number;
  kind: string;
  summary: string;
  details: SignTransactionReviewFact[];
};

export type SignTransactionReviewCommand = {
  index: number;
  kind: string;
  summary: string;
  details: SignTransactionReviewFact[];
  warnings: string[];
};

export type SignTransactionReviewGasPayment = {
  objectId: string;
  version: string;
  digest: string;
};

export type SignTransactionReviewGas = {
  owner: string;
  budget: string;
  price: string;
  payments: SignTransactionReviewGasPayment[];
};

export type SignTransactionReviewBalanceChange = {
  index: number;
  owner: string;
  coinType: string;
  amount: string;
  summary: string;
};

export type SignTransactionReviewObjectChange = {
  index: number;
  type: string;
  summary: string;
  details: SignTransactionReviewFact[];
};

export type SignTransactionReviewEvent = {
  index: number;
  type: string;
  summary: string;
  details: SignTransactionReviewFact[];
};

export type SignTransactionReview = {
  network: NETWORK;
  sender: string;
  sponsored: boolean;
  gas: SignTransactionReviewGas;
  inputs: SignTransactionReviewInput[];
  commands: SignTransactionReviewCommand[];
  dryRun: {
    status: 'success';
    balanceChanges: SignTransactionReviewBalanceChange[];
    objectChanges: SignTransactionReviewObjectChange[];
    events: SignTransactionReviewEvent[];
  };
  warnings: string[];
};

export interface ClipSigner {
  getAddress: () => string;
  getPublicKey: () => PublicKey;
  reviewTransaction: (
    review: SignTransactionReview,
  ) => boolean | Promise<boolean>;
  signTransaction: (transaction: Transaction) => Promise<SignedTransaction>;
  signPersonalMessage: (
    message: Uint8Array,
  ) => Promise<SuiSignPersonalMessageOutput>;
}
