import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import { useConnectWallet, useWallets } from '@mysten/dapp-kit';
import { useWalrusWallet } from '@zktx.io/walrus-wallet';
import { WALLET_NAME } from '../utils/config';

export const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { isConnected, updateJwt } = useWalrusWallet();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();

  useEffect(() => {
    const init = async () => {
      try {
        const { id_token: jwt } = queryString.parse(location.hash) as {
          id_token: string;
        };
        if (isConnected || !jwt) {
          navigate('/');
          return;
        }
        const wallet = wallets.find((w) => w.name === WALLET_NAME);
        if (wallet) {
          await updateJwt(jwt);
          connect(
            { wallet },
            {
              onSuccess: () => navigate('/'),
            },
          );
        }
      } catch (error) {
        alert(`${error}`);
      }
    };
    init();
  }, [location, navigate, updateJwt, wallets, connect, isConnected]);

  return (
    <div className="flex flex-col items-center p-4">
      <img src={'/logo-sui.svg'} className="w-32 h-32 mb-4" alt="logo" />
      <h1 className="text-3xl font-bold">Walrus Wallet - Demo</h1>
      <h2 className="text-xl text-gray-600">Auth</h2>
    </div>
  );
};
