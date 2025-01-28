import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { IdentifierString } from '@mysten/wallet-standard';

import { getAccountData } from './localStorage';
import { NETWORK } from './types';
import { WalletStandard } from './walletStandard';

export const createSponsoredTransaction = async (
  url: string,
  network: NETWORK,
  address: string,
  txBytes: Uint8Array,
): Promise<{ bytes: string; digest: string }> => {
  const res = await fetch(`${url}/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address,
      network,
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

export const executeSponsoredTransaction = async (
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
  url: string,
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
    if (!!account.zkLogin) {
      if (account.network === input.chain.split(':')[1]) {
        const client = new SuiClient({
          url: getFullnodeUrl(account.network),
        });
        const txBytes = await input.transaction.build({
          client,
          onlyTransactionKind: true,
        });
        const { bytes: sponsoredTxBuytes, digest } =
          await createSponsoredTransaction(
            url,
            account.network,
            account.address,
            txBytes,
          );
        const { signature } = await WalletStandard.Sign(
          account.zkLogin,
          fromBase64(sponsoredTxBuytes),
          true,
        );
        await executeSponsoredTransaction(url, digest, signature);

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
    } else {
      //
    }
    throw new Error('Chain error');
  }
  throw new Error("Can't sign and execute sponsored transaction");
};
