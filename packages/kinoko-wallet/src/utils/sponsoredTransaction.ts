import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { IdentifierString } from '@mysten/wallet-standard';

import { getAccountData } from './localStorage';
import { IAccount } from './types';
import { WalletStandard } from './walletStandard';

const createSponsoredTransaction = async (
  url: string,
  account: IAccount,
  txBytes: Uint8Array,
): Promise<{ bytes: string; digest: string }> => {
  const res = await fetch(`${url}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address: account.zkAddress.address,
      network: account.nonce.network,
      transactionBlockKindBytes: toBase64(txBytes),
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to create sponsored transaction');
  }
  const { bytes, digest } = await res.json();
  return {
    bytes,
    digest,
  };
};

const executeSponsoredTransaction = async (
  url: string,
  digest: string,
  signature: string,
) => {
  const res = await fetch(`${url}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      digest,
      signature,
    }),
  });

  if (!res.ok) {
    throw new Error('Failed to execute sponsored transaction');
  }
};

export const signAndExecuteSponsoredTransaction = async (
  url: {
    create: string;
    execute: string;
  },
  input: {
    transaction: Transaction;
    chain: IdentifierString;
  },
): Promise<{
  digest: string;
  bytes: string;
  signature: string;
  effects: string;
}> => {
  const account = getAccountData();
  if (!!account) {
    if (account.nonce.network === input.chain.split(':')[1]) {
      const client = new SuiClient({
        url: getFullnodeUrl(account.nonce.network),
      });
      const tx = await input.transaction.toJSON();
      const txBytes = await Transaction.from(tx).build({
        client,
        onlyTransactionKind: true,
      });
      const { bytes: sponsoredTxBuytes, digest } =
        await createSponsoredTransaction(url.create, account, txBytes);
      const { signature } = await WalletStandard.SignTransaction(
        account,
        fromBase64(sponsoredTxBuytes),
      );
      await executeSponsoredTransaction(url.execute, digest, signature);

      const { rawEffects } = await client.waitForTransaction({
        digest,
        options: {
          showRawEffects: true,
        },
      });
      return {
        digest,
        bytes: toBase64(txBytes),
        signature,
        effects: rawEffects ? toBase64(new Uint8Array(rawEffects)) : '',
      };
    }
    throw new Error('Chain error');
  }
  throw new Error("Can't sign and execute sponsored transaction");
};
