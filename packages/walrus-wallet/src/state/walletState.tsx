import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';

import { WalletStandard } from '../utils/walletStandard';

type WalletMode = 'dark' | 'light';

interface WalletStateValue {
  mode: WalletMode;
  wallet: WalletStandard | undefined;
  setMode: (mode: 'light' | 'dark') => void;
  setWallet: (wallet: WalletStandard) => void;
}

const WalletStateContext = createContext<WalletStateValue | undefined>(
  undefined,
);

export const WalletStateProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<WalletMode>('light');
  const [wallet, setWallet] = useState<WalletStandard | undefined>(undefined);

  const value = useMemo<WalletStateValue>(
    () => ({ mode, wallet, setMode, setWallet }),
    [mode, wallet],
  );

  return (
    <WalletStateContext.Provider value={value}>
      {children}
    </WalletStateContext.Provider>
  );
};

export const useWalletState = (): WalletStateValue => {
  const context = useContext(WalletStateContext);
  if (!context) {
    throw new Error(
      'useWalletState hook can only be used inside a WalrusWallet provider.',
    );
  }
  return context;
};
