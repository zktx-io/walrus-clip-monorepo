import { useEffect, useState } from 'react';

import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useSuiClient,
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { useKinokoWallet } from '@zktx.io/kinoko-wallet';
import { enqueueSnackbar } from 'notistack';
import { NETWORK } from '../utils/config';

export const Home = () => {
  const { connectionStatus } = useCurrentWallet();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutate: disconnect } = useDisconnectWallet();
  const {
    isScannerEnabled,
    signAndExecuteSponsoredTransaction,
    deposit,
    withdraw,
  } = useKinokoWallet();

  const [address, setAddress] = useState<string | undefined>(undefined);
  const [balance, setBalance] = useState<string | undefined>(undefined);

  const handleDisconnect = () => {
    setAddress(undefined);
    setBalance(undefined);
    disconnect();
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

        const result = await signAndExecuteSponsoredTransaction({
          transaction,
          chain: `sui:${NETWORK}`,
        });
        enqueueSnackbar(`${result.digest}`, {
          variant: 'success',
        });
      } catch (error) {
        enqueueSnackbar(`${error}`, {
          variant: 'error',
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
            });
          },
          onError: (error) => {
            enqueueSnackbar(`${error}`, {
              variant: 'error',
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
      const hash = await deposit(
        'Bill',
        'Please scan the QR code to deposit.',
        transaction,
        (notification) => {
          enqueueSnackbar(notification.message, {
            variant: notification.variant,
          });
        },
        true,
      );
      enqueueSnackbar(`${hash}`, {
        variant: 'success',
      });
    } catch (error) {
      enqueueSnackbar(`${error}`, {
        variant: 'error',
      });
    }
  };

  const onShowPay = async () => {
    try {
      const hash = await withdraw(
        'Pay',
        'Please scan the QR code to withdraw.',
        (notification) => {
          enqueueSnackbar(notification.message, {
            variant: notification.variant,
          });
        },
      );
      enqueueSnackbar(`${hash}`, {
        variant: 'success',
      });
    } catch (error) {
      enqueueSnackbar(`${error}`, {
        variant: 'error',
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
  }, [connectionStatus, account, client]);

  return (
    <>
      <img src={'/logo-sui.svg'} className="logo" alt="logo" />
      <h1>Kinoko Wallet</h1>
      <h2>Home</h2>
      <div>
        {connectionStatus === 'connected' ? (
          <div>
            <h3>Connected</h3>
            <div>
              <p style={{ marginBottom: '0px', fontSize: '24px' }}>Address</p>
              <p style={{ marginTop: '0px', fontSize: '16px' }}>
                {address || 'n/a'}
              </p>
              <p style={{ marginBottom: '0px', fontSize: '24px' }}>Balance</p>
              <p style={{ marginTop: '0px', fontSize: '16px' }}>
                {balance || 'n/a'}
              </p>
            </div>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              <button onClick={onSignAndExcuteTx}>
                Sign And Excute Sponsored Transaction
              </button>
              <div style={{ width: '100%', display: 'flex', gap: '8px' }}>
                <button
                  disabled={!isScannerEnabled}
                  style={{ width: '100%' }}
                  onClick={onShowBill}
                >
                  Bill
                </button>
                <button style={{ width: '100%' }} onClick={onShowPay}>
                  Pay
                </button>
              </div>
              <button onClick={handleDisconnect}>Disconnect</button>
            </div>
          </div>
        ) : (
          <ConnectButton />
        )}
      </div>
    </>
  );
};
