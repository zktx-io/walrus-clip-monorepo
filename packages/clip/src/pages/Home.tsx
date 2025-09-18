import {
  ConnectButton,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
} from '@mysten/dapp-kit';

export const Home = () => {
  const { connectionStatus } = useCurrentWallet();
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();

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
