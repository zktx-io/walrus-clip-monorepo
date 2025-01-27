import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { generateRandomness } from '@mysten/sui/zklogin';
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

interface IQRPayScanOption {
  title?: string;
  description?: string;
}

export const QRPayScan = ({
  mode = 'light',
  option,
  network,
  address,
  zkLogin,
  onEvent,
  onClose,
}: {
  mode?: 'dark' | 'light';
  option: IQRPayScanOption;
  network: NETWORK;
  address: string;
  zkLogin: IZkLogin;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result: string | { digest: string; effects: string }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const [destId, setDestId] = useState<string | undefined>(undefined);
  const [sponsored, setSponsored] = useState<boolean>(false);
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
          const connection = peer.connect(destId);
          connection.on('open', () => {
            connection.send(makeMessage(MessageType.STEP_0, address));
          });

          connection.on('data', async (data) => {
            try {
              const message = parseMessage(data as string);
              const client = new SuiClient({
                url: getFullnodeUrl(network),
              });
              switch (message.type) {
                case MessageType.STEP_1:
                  {
                    const { bytes, digest } = JSON.parse(message.value);
                    const { signature } = await WalletStandard.Sign(
                      zkLogin,
                      fromBase64(bytes),
                      true,
                    );
                    if (sponsored) {
                      connection.send(
                        makeMessage(
                          MessageType.STEP_2,
                          JSON.stringify({ signature, digest }),
                        ),
                      );
                      connection.open && connection.close({ flush: true });
                      open && setOpen(false);

                      const { rawEffects } = await client.waitForTransaction({
                        digest,
                        options: {
                          showRawEffects: true,
                        },
                      });

                      onClose({
                        digest,
                        effects: rawEffects
                          ? toBase64(new Uint8Array(rawEffects))
                          : '',
                      });
                    } else {
                      const { digest: digest2, errors } =
                        await client.executeTransactionBlock({
                          transactionBlock: bytes,
                          signature: signature,
                        });
                      connection.send(makeMessage(MessageType.STEP_2, digest2));
                      connection.open && connection.close({ flush: true });
                      open && setOpen(false);

                      if (!!errors) {
                        onClose(errors.toString());
                      } else {
                        const { rawEffects } = await client.waitForTransaction({
                          digest: digest2,
                          options: {
                            showRawEffects: true,
                          },
                        });
                        onClose({
                          digest: digest2,
                          effects: rawEffects
                            ? toBase64(new Uint8Array(rawEffects))
                            : '',
                        });
                      }
                    }
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
            <DlgTitle mode={mode}>{option.title}</DlgTitle>
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
                    (schema[3] === 'ts' || schema[3] === 'tx')
                  ) {
                    setDestId(schema.join('-'));
                    setSponsored(schema[3] == 'ts');
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
            {error ? error : option.description}
          </DlgDescription2>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
