import React, { useEffect, useState } from 'react';

import {
  generateRandomness,
  toZkLoginPublicIdentifier,
} from '@mysten/sui/zklogin';
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
import {
  IZkLogin,
  makeMessage,
  MessageType,
  NETWORK,
  NotiVariant,
  parseMessage,
} from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

export const QRLoginScan = ({
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
  onClose: (result?: string) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const [destId, setDestId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    const randomness = generateRandomness();
    const peer = new Peer(randomness);
    if (destId) {
      onEvent({
        variant: 'info',
        message: 'Connecting...',
      });
      setOpen(false);
      peer.on('open', (id) => {
        try {
          const connection = peer.connect(destId.replace(/::/g, '-'));
          const encoder = new TextEncoder();
          connection.on('open', async () => {
            const { signature } = await WalletStandard.Sign(
              zkLogin,
              encoder.encode(destId),
              false,
            );
            const publicKey = toZkLoginPublicIdentifier(
              BigInt(zkLogin.proofInfo.addressSeed),
              zkLogin.proofInfo.iss,
            ).toSuiPublicKey();
            connection.send(
              makeMessage(
                MessageType.STEP_0,
                JSON.stringify({ address, publicKey, signature }),
              ),
            );
          });

          connection.on('data', async (data) => {
            try {
              const message = parseMessage(data as string);
              switch (message.type) {
                case MessageType.STEP_1:
                  {
                    if (message.value === 'OK') {
                      onEvent({
                        variant: 'success',
                        message: 'Connected',
                      });
                    } else {
                      onEvent({
                        variant: 'error',
                        message: message.value,
                      });
                    }
                    onClose();
                  }
                  break;

                default:
                  onEvent({
                    variant: 'error',
                    message: `Unknown message type: ${message.type}`,
                  });
                  connection.open && connection.close({ flush: true });
                  open && setOpen(false);
                  onClose(`Unknown message type: ${message.type}`);
              }
            } catch (error) {
              connection.open && connection.close({ flush: true });
              open && setOpen(false);
              onClose(`${error}`);
            }
          });

          connection.on('error', (err) => {
            connection.open && connection.close({ flush: true });
            open && setOpen(false);
            onClose(`Connection error: ${err.message}`);
          });
        } catch (error) {
          onClose(`Failed to establish connection: ${error}`);
        }
      });

      peer.on('error', (err) => {
        setOpen(false);
        onClose(`Peer error: ${err.message}`);
      });

      return () => {
        peer.destroy();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destId]);

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
            <DlgTitle mode={mode}>Login</DlgTitle>
            <DlgClose
              mode={mode}
              onClick={() => {
                setOpen(false);
                onClose('User closed');
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
                    schema[3] === 'login'
                  ) {
                    setDestId(schema.join('::'));
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
                onClose(`${error}`);
              }}
            />
          </div>
          <DlgDescription2 mode={mode}>
            {error ? error : 'Please scan the QR code to log in.'}
          </DlgDescription2>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
