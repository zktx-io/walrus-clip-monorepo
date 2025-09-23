import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignPersonalMessage,
  useSignTransaction,
} from '@mysten/dapp-kit';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { PasskeyPublicKey } from '@mysten/sui/keypairs/passkey';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { Transaction } from '@mysten/sui/transactions';
import { ZkLoginPublicIdentifier } from '@mysten/sui/zklogin';
import { useWalrusWallet, WALLET_NAME } from '@zktx.io/walrus-wallet';
import { useEffect, useState } from 'react';

export const Home = () => {
  const { connectionStatus, currentWallet } = useCurrentWallet();
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: signPersonalMessage } = useSignPersonalMessage();
  const { mutate: signTransaction } = useSignTransaction();
  const { scan } = useWalrusWallet();
  const [isClip, setIsClip] = useState(false);

  const onScan = async () => {
    if (account) {
      await scan({
        getAddress: () => account.address,

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

        signTransaction: async (transaction: Transaction) => {
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
      });
    }
  };

  useEffect(() => {
    setIsClip(!!currentWallet && currentWallet.name === WALLET_NAME);
  }, [isClip, currentWallet]);

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
              {!isClip && (
                <div className="flex gap-2 w-full">
                  <button
                    className="w-full bg-blue-500 text-white py-2 px-2 rounded-lg cursor-pointer"
                    onClick={onScan}
                  >
                    Scan
                  </button>
                </div>
              )}
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
