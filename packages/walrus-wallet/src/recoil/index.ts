import { atom, useRecoilState } from 'recoil';

import { WalletStandard } from '../utils/walletStandard';

const modeState = atom<'dark' | 'light'>({
  key: 'modeState',
  default: 'light',
});

const walletState = atom<WalletStandard | undefined>({
  key: 'walletState',
  default: undefined,
});

export const useWalletState = () => {
  const [mode, setMode2] = useRecoilState(modeState);
  const [wallet, setWallet2] = useRecoilState(walletState);

  const setMode = (mode: 'light' | 'dark') => {
    setMode2(mode);
  };

  const setWallet = (newWallet: WalletStandard) => {
    setWallet2(newWallet);
  };

  return { mode, wallet, setMode, setWallet };
};
