import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
  useSignPersonalMessage,
  useSignTransaction,
} from '@mysten/dapp-kit';
import { IntentScope } from '@mysten/sui/cryptography';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { PasskeyPublicKey } from '@mysten/sui/keypairs/passkey';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { Transaction } from '@mysten/sui/transactions';
import { ZkLoginPublicIdentifier } from '@mysten/sui/zklogin';
import { useWalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';

import { NETWORK, WALLET_NAME } from '../utils/config';

export const Home = () => {
  const { connectionStatus, currentWallet } = useCurrentWallet();
  const account = useCurrentAccount();
  const { scan } = useWalrusWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const { mutate: signTransaction } = useSignTransaction();

  const { signAndExecuteSponsoredTransaction } = useWalrusWallet();

  const onScan = async () => {
    if (account) {
      await scan({
        toSuiAddress: () => account.address,
        getPublicKey: () => {
          switch (account.publicKey[0]) {
            case 0x00:
              return new Ed25519PublicKey(account.publicKey.slice(1));
            case 0x01:
              return new Secp256k1PublicKey(account.publicKey.slice(1));
            case 0x02:
              return new Secp256r1PublicKey(account.publicKey.slice(1));
            case 0x03:
              return new MultiSigPublicKey(account.publicKey.slice(1));
            case 0x05:
              return new ZkLoginPublicIdentifier(account.publicKey.slice(1));
            case 0x06:
              return new PasskeyPublicKey(account.publicKey.slice(1));
            default:
              break;
          }
          throw new Error('Not implemented (getPublicKey)');
        },
        getKeyScheme: () => {
          throw new Error('Not implemented (getKeyScheme)');
        },
        signPersonalMessage: async (bytes: Uint8Array) => {
          return new Promise((resolve, reject) => {
            signPersonalMessage(
              {
                message: bytes,
              },
              {
                onSuccess: (result) => {
                  resolve(result);
                },
                onError: (error) => {
                  reject(error);
                },
              },
            );
          });
        },
        signTransaction: async (bytes: Uint8Array) => {
          const transaction = await Transaction.from(bytes).toJSON();
          return new Promise((resolve, reject) => {
            signTransaction(
              {
                transaction,
              },
              {
                onSuccess: (result) => {
                  resolve(result);
                },
                onError: (error) => {
                  reject(error);
                },
              },
            );
          });
        },

        signWithIntent: (_bytes: Uint8Array, _intent: IntentScope) => {
          throw new Error('Not implemented (signWithIntent)');
        },

        sign: async (_bytes: Uint8Array) => {
          throw new Error('Not implemented (sign)');
        },
      });
    }
  };

  const onSignAndExcuteTx = async () => {
    if (account) {
      // console.log(account.address);
      // console.log(await transaction.toJSON());
      try {
        const transaction = new Transaction();
        transaction.setSender(account.address);
        transaction.moveCall({
          target:
            '0x06314af232888760ff6eb65d6acd0e9307546f89e30d8000d162bc3ae21bf639::counter::increment',
          arguments: [
            transaction.object(
              '0xd69afff191858d4dae9cfc7ed166306f9ca90e534833352f67b02abf8e6418be',
            ),
          ],
        });

        if (currentWallet && currentWallet.name === WALLET_NAME) {
          const result = await signAndExecuteSponsoredTransaction({
            network: NETWORK,
            transaction,
          });
          enqueueSnackbar(`${result.digest}`, {
            variant: 'success',
            style: {
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          });
        } else {
          const transaction = await new Transaction().toJSON();
          signAndExecuteTransaction(
            {
              transaction,
              chain: 'sui:testnet',
            },
            {
              onSuccess: (result) => {
                enqueueSnackbar(`${result.digest}`, {
                  variant: 'success',
                  style: {
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                });
              },
            },
          );
        }
      } catch (error) {
        enqueueSnackbar(`${error}`, {
          variant: 'error',
          style: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        });
      }
    }
  };

  return (
    <div className="flex flex-col items-center p-4">
      <img src={'/logo-walrus.png'} className="w-32 h-32 mb-4" alt="logo" />
      <h1 className="text-3xl font-bold">Walrus Clip</h1>
      <h2 className="text-xl text-gray-600">Home</h2>
      <div className="w-full max-w-md p-4 rounded-lg shadow-md mt-4">
        {connectionStatus === 'connected' && account ? (
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-bold text-green-600">Connected</h3>
            <div className="w-full text-center">
              <p>
                Walrus Clip unifies the wallet user experience and eliminates
                silos between dApps.
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-4">
              <div className="flex gap-2 w-full">
                <button
                  className="w-full bg-blue-500 text-white py-2 px-2 rounded-lg cursor-pointer"
                  onClick={onSignAndExcuteTx}
                >
                  {currentWallet && currentWallet.name === WALLET_NAME
                    ? 'Sponsored Transaction'
                    : 'Transaction'}
                </button>
                <button
                  className="w-full bg-blue-500 text-white py-2 px-2 rounded-lg cursor-pointer"
                  onClick={onScan}
                >
                  Scan
                </button>
              </div>
              <div className="flex gap-2 w-full">
                <button
                  className="w-full bg-red-500 text-white py-2 px-2 rounded-lg cursor-pointer"
                  onClick={() => disconnect()}
                >
                  Disconnect
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ConnectButton />
        )}
      </div>
    </div>
  );
};
