import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  // useSignAndExecuteTransaction,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useWalrusWallet } from '@zktx.io/walrus-wallet';
import { enqueueSnackbar } from 'notistack';
import { NETWORK, WALLET_NAME } from '../utils/config';

export const Home = () => {
  const navigate = useNavigate();
  const { connectionStatus, currentWallet } = useCurrentWallet();
  const account = useCurrentAccount();
  const client = useSuiClient();

  const { mutate: disconnect } = useDisconnectWallet();
  // const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  const {
    isConnected,
    /* scan,*/
    isScannerEnabled,
    signAndExecuteSponsoredTransaction,
    pay,
  } = useWalrusWallet();

  const [address, setAddress] = useState<string | undefined>(undefined);
  const [balance, setBalance] = useState<string | undefined>(undefined);

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

        const result = await signAndExecuteSponsoredTransaction({
          transaction,
          chain: `sui:${NETWORK}`,
        });
        enqueueSnackbar(`${result.digest}`, {
          variant: 'success',
          style: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        });
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
      /*
      signAndExecuteTransaction(
        {
          transaction,
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
      */
    }
  };

  const onShowBill = async () => {
    try {
      const transaction = new Transaction();
      transaction.moveCall({
        target:
          '0x06314af232888760ff6eb65d6acd0e9307546f89e30d8000d162bc3ae21bf639::counter::increment',
        arguments: [
          transaction.object(
            '0xd69afff191858d4dae9cfc7ed166306f9ca90e534833352f67b02abf8e6418be',
          ),
        ],
      });
      const { digest } = await pay('Bill', 'Please scan the QR code to pay.', {
        transaction,
        isSponsored: true,
      });
      enqueueSnackbar(digest, {
        variant: 'success',
        style: {
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      });
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
  };

  useEffect(() => {
    if (connectionStatus === 'connected' && account) {
      setAddress(account.address);
      client
        .getBalance({
          owner: account.address,
        })
        .then(({ totalBalance }) => setBalance(totalBalance));
    }
  }, [connectionStatus, account, client, isConnected]);

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
      <img src={'/logo-sui.svg'} className="w-32 h-32 mb-4" alt="logo" />
      <h1 className="text-3xl font-bold">Walrus Wallet</h1>
      <h2 className="text-xl text-gray-600">Home</h2>
      <div className="w-full max-w-md p-4 rounded-lg shadow-md mt-4">
        {connectionStatus === 'connected' ? (
          <div className="flex flex-col items-center">
            <h3 className="text-xl font-bold text-green-600">Connected</h3>
            <div className="w-full text-center">
              <p className="text-lg font-bold mb-1">Address</p>
              <p className="text-sm break-all text-center">
                {address || 'n/a'}
              </p>
              <p className="text-lg font-bold mt-2 mb-1">Balance</p>
              <p className="text-sm">{balance || 'n/a'}</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-4">
              <div className="flex gap-2 w-full">
                <button
                  className="w-full bg-blue-500 text-white py-2 rounded-lg cursor-pointer"
                  onClick={onSignAndExcuteTx}
                >
                  Sponsored Transaction
                </button>
                <button
                  disabled={!isScannerEnabled}
                  className="w-full bg-blue-500 text-white py-2 rounded-lg disabled:bg-gray-300 cursor-pointer"
                  onClick={onShowBill}
                >
                  Bill
                </button>
              </div>
            </div>
          </div>
        ) : (
          <ConnectButton />
        )}
        <div>
          <button
            className="px-8 text-white py-2 rounded-lg mt-2 border-2 border-transparent hover:border-white hover:bg-transparent transition-all cursor-pointer"
            onClick={() => navigate('/kiosk')}
          >
            Go to Kiosk
          </button>
        </div>
      </div>
    </div>
  );
};
