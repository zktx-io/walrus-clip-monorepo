import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import queryString from 'query-string';
import { useConnectWallet, useWallets } from '@mysten/dapp-kit';
import { useKinokoWallet } from '@zktx.io/kinoko-wallet';
import { WALLET_NAME } from '../utils/config';

export const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { isLoggedIn, login } = useKinokoWallet();
  const wallets = useWallets();
  const { mutate: connect } = useConnectWallet();

  useEffect(() => {
    const init = async () => {
      try {
        const { id_token: jwt } = queryString.parse(location.hash) as {
          id_token: string;
        };
        if (isLoggedIn() || !jwt) {
          navigate('/');
          return;
        }
        const wallet = wallets.find((w) => w.name === WALLET_NAME);
        if (wallet) {
          await login(jwt);
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
  }, [location, navigate, isLoggedIn, login, wallets, connect]);

  return (
    <>
      <img src={'/logo-sui.svg'} className="logo" alt="logo" />
      <h1>Kinoko Wallet</h1>
      <h2>Login</h2>
    </>
  );
};
