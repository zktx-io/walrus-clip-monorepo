import { b64urlDecode, b64urlEncode } from './connection';

export type QrType = 'login' | 'sign';

export function buildPeerId(params: {
  network: string;
  token: string;
  type: QrType;
  iceConfigUrl?: string;
}) {
  const { network, token, type, iceConfigUrl } = params;
  const suffix = iceConfigUrl ? `::${b64urlEncode(iceConfigUrl)}` : '';
  return `sui::${network}::${token}::${type}${suffix}`;
}

export function parsePeerId(raw: string) {
  const parts = raw.split('::');
  if (parts.length < 4 || parts[0] !== 'sui') return undefined;
  const [_, network, token, type] = parts;
  let iceConfigUrl: string | undefined;

  if (parts.length >= 5) {
    try {
      iceConfigUrl = b64urlDecode(parts[4]);
    } catch {}
  }
  return { network, token, type: type as QrType, iceConfigUrl };
}
