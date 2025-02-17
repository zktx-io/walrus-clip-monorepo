import { REDIRECT_URL } from './config.ts';

export const getProviderUrl = (nonce: string, client_id: string): string => {
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${client_id}&redirect_uri=${REDIRECT_URL}&response_type=id_token&nonce=${nonce}&scope=openid`;
};
