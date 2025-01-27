import { IAccount, IZkLogin, NETWORK } from './types';

export const getZkLoginData = ():
  | undefined
  | { network: NETWORK; zkLogin: IZkLogin } => {
  const data = localStorage.getItem('nonce');
  return data ? JSON.parse(data) : undefined;
};

export const setZkLoginData = (data: {
  network: NETWORK;
  zkLogin: IZkLogin;
}) => {
  localStorage.setItem('nonce', JSON.stringify(data));
};

export const getAccountData = (): undefined | IAccount => {
  const data = localStorage.getItem('account');
  return data ? JSON.parse(data) : undefined;
};

export const setAccountData = (data: IAccount) => {
  localStorage.removeItem('nonce');
  localStorage.setItem('account', JSON.stringify(data));
};

export const disconnect = () => {
  localStorage.clear();
};
