import React, { useCallback, useEffect, useState } from 'react';

import { IDetectedBarcode, Scanner } from '@yudiel/react-qr-scanner';
import Peer from 'peerjs';
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
import { NotiVariant } from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

type QRScanType = 'address' | 'login' | 'sign' | 'verification';

export const QRScan = ({
  mode = 'light',
  wallet,
  onEvent,
  onClose,
  scanAddress,
}: {
  mode?: 'dark' | 'light';
  wallet: WalletStandard;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: { digest: string; effects: string }[]) => void;
  scanAddress?: (address: string) => void;
}) => {
  const [title, setTitle] = useState<string>('Scan');
  const [open, setOpen] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [destId, setDestId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<QRScanType | undefined>(undefined);

  const handleClose = useCallback(
    (error?: string) => {
      if (error) {
        onEvent({
          variant: 'error',
          message: error,
        });
      }
      setOpen(false);
      onClose();
    },
    [onClose, onEvent],
  );

  const handleScan = useCallback(
    (result: IDetectedBarcode[]) => {
      if (result[0].format === 'qr_code' && wallet.signer) {
        const schema = result[0].rawValue.split('::');
        if (
          schema.length === 4 &&
          schema[0] === 'sui' &&
          schema[1] === wallet.signer.network &&
          (schema[3] === 'login' || schema[3] === 'sign')
        ) {
          setDestId(schema.join('::'));
          setType(schema[3]);
        } else if (schema.length === 1) {
          setType('address');
          setDestId(schema[0]);
        } else {
          if (schema.length !== 4) {
            setError('Invalid schema');
          } else if (schema[0] !== 'sui') {
            setError('Invalid chain');
          } else if (schema[1] !== wallet.signer.network) {
            setError('Invalid network');
          } else {
            setError('invalid type');
          }
        }
      }
    },
    [wallet],
  );

  useEffect(() => {
    let peer: Peer | undefined = undefined;
    if (!!wallet && !!destId && !!type) {
      if (scanAddress) {
        switch (type) {
          case 'address':
            setOpen(false);
            scanAddress(destId);
            break;
          default:
            break;
        }
      } else {
        switch (type) {
          case 'login':
            peer = connectQRLogin({
              wallet,
              destId,
              setOpen,
              onClose: () => {
                setOpen(false);
                onClose();
              },
              onEvent,
            });
            break;
          case 'sign':
            peer = connectQRSign({
              wallet,
              destId,
              setOpen,
              onClose: (result) => {
                setOpen(false);
                onClose(result);
              },
              onEvent,
            });
            break;
          case 'verification':
            // TODO
            break;
          default:
            break;
        }
      }
    }
    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, [wallet, destId, type, scanAddress, onEvent, onClose]);

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
            <DlgTitle mode={mode}>{title}</DlgTitle>
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
