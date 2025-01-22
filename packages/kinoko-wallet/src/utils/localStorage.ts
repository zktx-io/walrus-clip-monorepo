import { IAccount, INonce } from './types';

export const getNonceData = (): undefined | INonce => {
  const data = localStorage.getItem('nonce');
  return data ? JSON.parse(data) : undefined;
};

export const setNonceData = (data: INonce) => {
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
