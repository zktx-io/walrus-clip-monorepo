import { useEffect } from 'react';

import { useDAppKit, useWallets } from '@mysten/dapp-kit-react';
import { useWalrusWallet, WALLET_NAME } from '@zktx.io/walrus-wallet';
import queryString from 'query-string';
import { useLocation, useNavigate } from 'react-router-dom';

export const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { walrusWalletStatus, updateJwt } = useWalrusWallet();
  const wallets = useWallets();
  const dAppKit = useDAppKit();

  useEffect(() => {
    const init = async () => {
      try {
        const { id_token: jwt } = queryString.parse(location.hash) as {
          id_token: string;
        };
        if (walrusWalletStatus() === 'connected' || !jwt) {
          navigate('/');
          return;
        }
        const wallet = wallets.find((w) => w.name === WALLET_NAME);
        if (wallet) {
          const isSuccess = await updateJwt(jwt);
          if (isSuccess) {
            await dAppKit.connectWallet({ wallet });
            navigate('/');
          }
        }
      } catch (error) {
        alert(`${error}`);
      }
    };
    init();
  }, [location, navigate, updateJwt, wallets, dAppKit, walrusWalletStatus]);

  return (
    <div className="flex flex-col items-center p-4">
      <img src={'/logo-walrus.png'} className="w-32 h-32 mb-4" alt="logo" />
      <h1 className="text-3xl font-bold">Walrus Clip</h1>
      <h2 className="text-xl text-gray-600">Auth</h2>
    </div>
  );
};
