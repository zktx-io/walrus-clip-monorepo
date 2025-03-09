import React, { useCallback, useState } from 'react';

import { Signer } from '@mysten/sui/cryptography';
import { IDetectedBarcode, Scanner } from '@yudiel/react-qr-scanner';
import { HiOutlineXMark } from 'react-icons/hi2';

import {
  DlgButtonIcon,
  DlgContentQR,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { connectQRLogin } from './QRLoginCode';
import { connectQRSign } from './QRSignCode';
import { NETWORK, NotiVariant } from '../utils/types';

type QRScanType = 'login' | 'sign' | 'verification';

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
  signer: Signer;
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
      if (result[0].format === 'qr_code') {
        const schema = result[0].rawValue.split('::');
        if (
          schema.length === 4 &&
          schema[0] === 'sui' &&
          schema[1] === network &&
          (schema[3] === 'login' || schema[3] === 'sign')
        ) {
          const destId = schema.join('::');
          const type = schema[3] as QRScanType;
          onClose(false);
          switch (type) {
            case 'login':
              connectQRLogin({
                signer,
                destId,
                onEvent,
              });
              break;
            case 'sign':
              connectQRSign({
                signer,
                network,
                destId,
                onEvent,
              });
              break;
            case 'verification':
              // TODO
              break;
            default:
              break;
          }
        } else {
          if (schema.length !== 4) {
            setError('Invalid schema');
          } else if (schema[0] !== 'sui') {
            setError('Invalid chain');
          } else if (schema[1] !== network) {
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
              <HiOutlineXMark />
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
