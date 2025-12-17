import { useCallback, useState } from 'react';

import { IDetectedBarcode, Scanner } from '@yudiel/react-qr-scanner';
import { X } from 'lucide-react';

import {
  DlgButtonIcon,
  DlgContentQR,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { connectQRLogin } from './QRLogin';
import { connectQRSign } from './QRSign';
import { ClipSigner, NETWORK, NotiVariant, QRScanType } from '../types';

export const QRScan = ({
  mode,
  open,
  signer,
  network,
  onEvent,
  onClose,
}: {
  mode: 'dark' | 'light';
  open: boolean;
  signer: ClipSigner;
  network: NETWORK;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (isBack: boolean) => void;
}) => {
  const [error, setError] = useState<string | undefined>(undefined);

  const handleClose = useCallback(
    (error?: string) => {
      if (error) {
        onEvent({
          variant: 'error',
          message: error,
        });
      }
      onClose(true);
    },
    [onClose, onEvent],
  );

  const handleScan = useCallback(
    (result: IDetectedBarcode[]) => {
      const first = result?.[0];
      if (!first) return;
      if (first.format === 'qr_code') {
        const parts = first.rawValue.split('::');
        if (
          (parts.length === 4 || parts.length === 5) &&
          parts[0] === 'sui' &&
          parts[1] === network &&
          (parts[3] === 'login' || parts[3] === 'sign')
        ) {
          const type = parts[3] as QRScanType;
          const destId = parts.join('::');

          // Decode optional iceConfigUrl if present
          let iceConfigUrlFromQR: string | undefined;
          if (parts.length === 5) {
            try {
              // lazy local decode to avoid importing helper here
              const b64 = parts[4];
              const pad =
                b64.length % 4 === 2 ? '==' : b64.length % 4 === 3 ? '=' : '';
              iceConfigUrlFromQR = atob(
                b64.replace(/-/g, '+').replace(/_/g, '/') + pad,
              );
            } catch {
              // ignore decode errors -> fallback to default ICE
            }
          }

          onClose(false);
          switch (type) {
            case 'login':
              connectQRLogin({
                signer,
                destId,
                onEvent,
                iceConfigUrl: iceConfigUrlFromQR,
              });
              break;
            case 'sign':
              connectQRSign({
                signer,
                network,
                destId,
                onEvent,
                iceConfigUrl: iceConfigUrlFromQR,
              });
              break;
            default:
              break;
          }
        } else {
          if (parts.length !== 4 && parts.length !== 5) {
            setError('Invalid schema');
          } else if (parts[0] !== 'sui') {
            setError('Invalid chain');
          } else if (parts[1] !== network) {
            setError('Invalid network');
          } else {
            setError('invalid type');
          }
        }
      }
    },
    [network, onEvent, onClose, signer],
  );

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay
          mode={mode}
          onClick={() => {
            handleClose();
          }}
        />
        <DlgContentQR
          mode={mode}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <DlgTitle mode={mode}>Scan</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => {
                handleClose();
              }}
            >
              <X />
            </DlgButtonIcon>
          </div>
          <div
            style={{ position: 'relative', width: '100%', marginTop: '12px' }}
          >
            <Scanner
              styles={{
                container: { width: '256px', height: '256px' },
                video: { width: '256px', height: '256px' },
              }}
              formats={['qr_code']}
              onScan={handleScan}
              onError={(error) => {
                handleClose(`${error}`);
              }}
            />
          </div>
          <DlgDescription2 mode={mode}>
            {error ? error : 'Please scan the QR code.'}
          </DlgDescription2>
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
