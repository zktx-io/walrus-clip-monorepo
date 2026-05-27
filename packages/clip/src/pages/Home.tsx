import { useEffect, useState } from 'react';

import {
  useCurrentAccount,
  useCurrentWallet,
  useDAppKit,
  useWalletConnection,
} from '@mysten/dapp-kit-react';
import { ConnectButton } from '@mysten/dapp-kit-react/ui';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { PasskeyPublicKey } from '@mysten/sui/keypairs/passkey';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import {
  formatSignTransactionReview,
  useWalrusSignerScan,
} from '@zktx.io/walrus-connect/signer-app';
import { WALLET_NAME } from '@zktx.io/walrus-wallet';

export const Home = () => {
  const currentWallet = useCurrentWallet();
  const { isConnected } = useWalletConnection();
  const account = useCurrentAccount();
  const dAppKit = useDAppKit();
  const { scan } = useWalrusSignerScan();
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
            case 0x06:
              return new PasskeyPublicKey(account.publicKey.slice(1));
            default:
              break;
          }
          throw new Error('Not implemented (getPublicKey)');
        },

        reviewTransaction: async (review) =>
          window.confirm(formatSignTransactionReview(review)),

        signPersonalMessage: async (bytes) =>
          await dAppKit.signPersonalMessage({ message: bytes }),

        signTransaction: async (transaction) =>
          await dAppKit.signTransaction({ transaction }),
      });
    }
  };

  useEffect(() => {
    setIsClip(!!currentWallet && currentWallet.name === WALLET_NAME);
  }, [currentWallet]);

  return (
    <div className="flex flex-col items-center p-4">
      <img src={'/logo-walrus.png'} className="w-32 h-32 mb-4" alt="logo" />
      <h1 className="text-3xl font-bold">Walrus Clip</h1>
      <h2 className="text-xl text-gray-600">Home</h2>
      <div className="w-full max-w-md p-4 rounded-lg shadow-md mt-4">
        {isConnected && account ? (
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
                  onClick={() => dAppKit.disconnectWallet()}
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
