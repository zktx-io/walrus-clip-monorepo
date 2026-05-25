import { useCallback, useEffect, useRef, useState } from 'react';

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
import { connectQRLogin } from '../protocol/loginScannerSession';
import { connectQRSign } from '../protocol/signScannerConnector';
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import { parsePeerId } from '../webrtc/qr-id';

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
  const scanHandledRef = useRef(false);
  const connectionCleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!open) {
      connectionCleanupRef.current?.();
      connectionCleanupRef.current = undefined;
      return;
    }
    scanHandledRef.current = false;
    setError(undefined);
    connectionCleanupRef.current?.();
    connectionCleanupRef.current = undefined;
  }, [open]);

  useEffect(
    () => () => {
      connectionCleanupRef.current?.();
      connectionCleanupRef.current = undefined;
    },
    [],
  );

  const handleClose = useCallback(
    (error?: string) => {
      connectionCleanupRef.current?.();
      connectionCleanupRef.current = undefined;
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
      if (scanHandledRef.current) return;

      const first = result?.[0];
      if (!first) return;
      if (first.format === 'qr_code') {
        const parsedPeerId = parsePeerId(first.rawValue);
        if (!parsedPeerId) {
          setError('Invalid QR peer id');
          return;
        }

        if (parsedPeerId.network !== network) {
          setError('Invalid network');
          return;
        }

        scanHandledRef.current = true;
        setError('Connecting...');

        const onConnected = () => {
          connectionCleanupRef.current = undefined;
          onClose(false);
        };
        const onConnectionFailure = (message: string) => {
          connectionCleanupRef.current = undefined;
          scanHandledRef.current = false;
          setError(message);
        };

        switch (parsedPeerId.type) {
          case 'login': {
            const handle = connectQRLogin({
              signer,
              destId: first.rawValue,
              onEvent,
              iceConfigUrl: parsedPeerId.iceConfigUrl,
              onConnected,
              onConnectionFailure,
            });
            connectionCleanupRef.current = handle?.cleanup;
            break;
          }
          case 'sign': {
            const handle = connectQRSign({
              signer,
              network,
              destId: first.rawValue,
              onEvent,
              iceConfigUrl: parsedPeerId.iceConfigUrl,
              onConnected,
              onConnectionFailure,
            });
            connectionCleanupRef.current = handle?.cleanup;
            break;
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
