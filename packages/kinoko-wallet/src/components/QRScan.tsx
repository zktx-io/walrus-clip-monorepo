import React, { useEffect, useState } from 'react';

import { Cross2Icon } from '@radix-ui/react-icons';
import { Scanner } from '@yudiel/react-qr-scanner';
import Peer from 'peerjs';

import {
  DlgClose,
  DlgContent,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { connectQRLogin } from './QRLoginCode';
import { connectQRPay } from './QRPayCode';
import { IZkLogin, NETWORK, NotiVariant } from '../utils/types';

export const QRScan = ({
  mode = 'light',
  network,
  address,
  zkLogin,
  onEvent,
  onClose,
}: {
  mode?: 'dark' | 'light';
  network: NETWORK;
  address: string;
  zkLogin: IZkLogin;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: { digest: string; effects: string }) => void;
}) => {
  const [title, setTitle] = useState<string>('Scan');
  const [open, setOpen] = useState<boolean>(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [destId, setDestId] = useState<string | undefined>(undefined);
  const [type, setType] = useState<'login' | 'transaction' | undefined>(
    undefined,
  );

  useEffect(() => {
    let peer: Peer | undefined = undefined;
    if (!!destId && !!type) {
      if (type === 'login') {
        peer = connectQRLogin({
          destId,
          address,
          zkLogin,
          setOpen,
          onClose: () => {
            setOpen(false);
            onClose();
          },
          onEvent,
        });
      } else {
        peer = connectQRPay({
          destId,
          network,
          address,
          zkLogin,
          setOpen,
          onClose: (result) => {
            setOpen(false);
            onClose(result);
          },
          onEvent,
        });
      }
    }
    return () => {
      if (peer) {
        peer.destroy();
      }
    };
  }, [address, destId, network, onClose, onEvent, type, zkLogin]);

  const handleClose = (error: string) => {
    error &&
      onEvent({
        variant: 'error',
        message: error,
      });
    open && setOpen(false);
  };

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} />
        <DlgContent
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
            <DlgClose
              mode={mode}
              onClick={() => {
                handleClose('User closed');
              }}
            >
              <Cross2Icon />
            </DlgClose>
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
              onScan={(result) => {
                if (result[0].format === 'qr_code') {
                  const schema = result[0].rawValue.split('::');
                  if (
                    schema[0] === 'sui' &&
                    schema[1] === network &&
                    (schema[3] === 'transaction' || schema[3] === 'login')
                  ) {
                    setDestId(schema.join('::'));
                    setType(schema[3]);
                  } else {
                    if (schema[0] !== 'sui') {
                      setError('Invalid chain');
                    } else if (schema[1] !== network) {
                      setError('Invalid network');
                    } else {
                      setError('invalid type');
                    }
                  }
                }
              }}
              onError={(error) => {
                setOpen(false);
                handleClose(`${error}`);
              }}
            />
          </div>
          <DlgDescription2 mode={mode}>
            {error ? error : 'Please scan the QR code.'}
          </DlgDescription2>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
