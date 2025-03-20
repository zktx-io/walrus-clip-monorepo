import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';

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
  wallet: WalletStandard,
  url: string,
  input: {
    transaction: {
      toJSON: () => Promise<string>;
    };
    network: NETWORK;
  },
): Promise<{
  digest: string;
  bytes: string;
  signature: string;
  effects: string;
}> => {
  const account = getAccountData();
  const txb = Transaction.from(await input.transaction.toJSON());
  if (!!account) {
    if (!!wallet.signer) {
      if (account.network === input.network) {
        const client = new SuiClient({
          url: getFullnodeUrl(account.network),
        });
        const txBytes = await txb.build({
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
        const { signature } = await wallet.signer.signTransaction(
          fromBase64(sponsoredTxBuytes),
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
      const { digest, bytes, signature, effects } =
        await wallet.openQrSignModal(
          'Bill',
          'Please scan the QR code to pay.',
          {
            transaction: txb,
            isSponsored: true,
          },
        );
      return {
        digest,
        bytes,
        signature,
        effects,
      };
    }
    throw new Error('Chain error');
  }
  throw new Error("Can't sign and execute sponsored transaction");
};
