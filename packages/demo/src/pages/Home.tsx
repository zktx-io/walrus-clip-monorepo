import { useEffect } from 'react';

import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSignAndExecuteTransaction,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useWalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';

import { NETWORK, WALLET_NAME } from '../utils/config';

export const Home = () => {
  const navigate = useNavigate();
  const { connectionStatus, currentWallet } = useCurrentWallet();
  const account = useCurrentAccount();

  const { mutate: disconnect } = useDisconnectWallet();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const { isConnected, signAndExecuteSponsoredTransaction } = useWalrusWallet();

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
          signAndExecuteTransaction(
            {
              transaction: await transaction.toJSON(),
              chain: `sui:${NETWORK}`,
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
              onError: (error) => {
                enqueueSnackbar(`${error}`, {
                  variant: 'error',
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

  useEffect(() => {
    if (
      connectionStatus === 'connected' &&
      !isConnected &&
      currentWallet.name === WALLET_NAME
    ) {
      disconnect();
    }
  }, [isConnected, connectionStatus, disconnect, currentWallet?.name]);

  return (
    <div className="flex flex-col items-center p-4">
      <img src={'/logo-walrus.png'} className="w-32 h-32 mb-4" alt="logo" />
      <h1 className="text-3xl font-bold">Walrus Clip Demo</h1>
      <h2 className="text-xl text-gray-600">Home</h2>
      <div className="w-full max-w-md p-4 rounded-lg shadow-md mt-4">
        {connectionStatus === 'connected' ? (
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
                  className="w-full bg-blue-500 text-white py-2 rounded-lg cursor-pointer"
                  onClick={onSignAndExcuteTx}
                >
                  {currentWallet && currentWallet.name === WALLET_NAME
                    ? 'Sponsored Transaction'
                    : 'Transaction'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ConnectButton />
        )}
        <div className="flex flex-col gap-2 mt-2">
          <button
            className="py-1 bg-white text-black rounded-lg border-2 border-transparent hover:border-white hover:bg-transparent hover:text-white transition-all cursor-pointer"
            onClick={() => navigate('/kiosk')}
          >
            Go to Kiosk Page
          </button>
          <button
            className="py-1 bg-white text-black rounded-lg border-2 border-transparent hover:border-white hover:bg-transparent hover:text-white transition-all cursor-pointer"
            onClick={() => navigate('/ticket')}
          >
            Go to Ticket Page
          </button>
        </div>
      </div>
    </div>
  );
};
