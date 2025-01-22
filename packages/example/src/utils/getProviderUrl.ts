import { CLIENT_ID, REDIRECT_URL } from './.config.ts';

export const getProviderUrl = (nonce: string): string => {
  return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URL}&response_type=id_token&nonce=${nonce}&scope=openid`;
};
