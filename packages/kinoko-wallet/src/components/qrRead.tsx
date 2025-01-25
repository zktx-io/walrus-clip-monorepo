import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { fromBase64 } from '@mysten/sui/utils';
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
  IAccount,
  makeMessage,
  MessageType,
  NotiVariant,
  parseMessage,
} from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

export interface IWithdrawOption {
  title?: string;
  description?: string;
}

export const QrRead = ({
  mode = 'light',
  option,
  account,
  onEvent,
  onClose,
}: {
  mode?: 'dark' | 'light';
  option: IWithdrawOption;
  account: IAccount;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (error: boolean, message: string) => void;
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
            connection.send(
              makeMessage(MessageType.STEP_0, account.zkAddress.address),
            );
          });

          connection.on('data', async (data) => {
            try {
              const message = parseMessage(data as string);
              switch (message.type) {
                case MessageType.STEP_1:
                  {
                    const { bytes, digest } = JSON.parse(message.value);
                    const { signature } = await WalletStandard.SignTransaction(
                      account,
                      fromBase64(bytes),
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
                      onClose(false, digest);
                    } else {
                      const client = new SuiClient({
                        url: getFullnodeUrl(account.nonce.network),
                      });
                      const { digest: digest2, errors } =
                        await client.executeTransactionBlock({
                          transactionBlock: bytes,
                          signature: signature,
                        });
                      connection.send(makeMessage(MessageType.STEP_2, digest2));
                      connection.open && connection.close({ flush: true });
                      open && setOpen(false);
                      onClose(!!errors, `${errors}` || digest2);
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
                  onClose(true, `Unknown message type: ${message.type}`);
              }
            } catch (error) {
              connection.open && connection.close({ flush: true });
              open && setOpen(false);
              onClose(true, `${error}`);
            }
          });

          connection.on('error', (err) => {
            connection.open && connection.close({ flush: true });
            open && setOpen(false);
            onClose(true, `Connection error: ${err.message}`);
          });
        } catch (error) {
          onClose(true, `Failed to establish connection: ${error}`);
        }
      });

      peer.on('error', (err) => {
        setOpen(false);
        onClose(true, `Peer error: ${err.message}`);
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
                onClose(true, 'User closed');
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
                  const schema = result[0].rawValue.split('-');
                  if (
                    schema[0] === 'sui' &&
                    schema[1] === account.nonce.network
                  ) {
                    setDestId(result[0].rawValue);
                    setSponsored(schema.length === 4);
                  } else if (schema[0] !== 'sui') {
                    setError('Invalid chain');
                  } else if (schema[1] !== account.nonce.network) {
                    setError('Invalid network');
                  }
                }
              }}
              onError={(error) => {
                setOpen(false);
                onClose(true, `${error}`);
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
