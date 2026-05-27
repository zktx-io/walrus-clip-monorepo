import type { NETWORK } from '../types';

export type QrType = 'login' | 'sign';

const QR_NETWORKS = new Set<NETWORK>(['mainnet', 'testnet', 'devnet']);
const QR_TYPES = new Set<QrType>(['login', 'sign']);

const isQrNetwork = (value: string): value is NETWORK =>
  QR_NETWORKS.has(value as NETWORK);

const isQrType = (value: string): value is QrType =>
  QR_TYPES.has(value as QrType);

const b64urlEncode = (str: string) =>
  btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (b64url: string) => {
  const pad =
    b64url.length % 4 === 2 ? '==' : b64url.length % 4 === 3 ? '=' : '';
  return atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
};

export function buildPeerId(params: {
  network: NETWORK;
  sessionId: string;
  type: QrType;
  iceConfigUrl?: string;
}) {
  const { network, sessionId, type, iceConfigUrl } = params;
  const suffix = iceConfigUrl ? `::${b64urlEncode(iceConfigUrl)}` : '';
  return `sui::${network}::${sessionId}::${type}${suffix}`;
}

export function parsePeerId(raw: string) {
  const parts = raw.split('::');
  if (parts.length !== 4 && parts.length !== 5) return undefined;
  if (parts[0] !== 'sui') return undefined;

  const [, network, sessionId, type] = parts;
  if (!isQrNetwork(network) || !sessionId || !isQrType(type)) {
    return undefined;
  }

  let iceConfigUrl: string | undefined;

  if (parts.length === 5) {
    if (!parts[4]) return undefined;
    try {
      iceConfigUrl = b64urlDecode(parts[4]);
      if (!iceConfigUrl) return undefined;
    } catch {
      return undefined;
    }
  }

  return { network, sessionId, type, iceConfigUrl };
}
