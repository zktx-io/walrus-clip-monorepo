import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { generateRandomness } from '@mysten/sui/zklogin';
import { Cross2Icon } from '@radix-ui/react-icons';
import Peer from 'peerjs';
import { QRCode } from 'react-qrcode-logo';

import {
  DlgButton,
  DlgClose,
  DlgContent,
  DlgDescription,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
} from '../utils/sponsoredTransaction';
import {
  makeMessage,
  MessageType,
  NETWORK,
  NotiVariant,
  parseMessage,
} from '../utils/types';

export interface IDepositOption {
  title?: string;
  description?: string;
  transaction: Transaction;
}

export const QrShow = ({
  mode = 'light',
  option,
  network,
  sponsored,
  icon,
  onEvent,
  onClose,
}: {
  mode?: 'dark' | 'light';
  option: IDepositOption;
  network: NETWORK;
  sponsored?: string;
  icon: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (error: boolean, message: string) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = sponsored
    ? `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::s`
    : `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}`;

  useEffect(() => {
    const peer = new Peer(peerId.replace(/::/g, '-'));

    peer.on('connection', (connection) => {
      connection.on('data', async (data) => {
        try {
          const message = parseMessage(data as string);
          switch (message.type) {
            case MessageType.STEP_0:
              {
                onEvent({
                  variant: 'info',
                  message: 'Connecting...',
                });
                setOpen(false);
                const client = new SuiClient({
                  url: getFullnodeUrl(network),
                });
                option.transaction.setSenderIfNotSet(message.value);
                const txBytes = await option.transaction.build({
                  client,
                  ...(sponsored !== undefined && { onlyTransactionKind: true }),
                });
                if (sponsored !== undefined) {
                  const { bytes: sponsoredTxBytes, digest } =
                    await createSponsoredTransaction(
                      sponsored,
                      network,
                      message.value,
                      txBytes,
                    );
                  connection.send(
                    makeMessage(
                      MessageType.STEP_1,
                      JSON.stringify({ bytes: sponsoredTxBytes, digest }),
                    ),
                  );
                } else {
                  connection.send(
                    makeMessage(
                      MessageType.STEP_1,
                      JSON.stringify({ bytes: toBase64(txBytes) }),
                    ),
                  );
                }
              }
              break;

            case MessageType.STEP_2:
              {
                if (sponsored !== undefined) {
                  onEvent({
                    variant: 'info',
                    message: 'Executing sponsored transaction...',
                  });
                  const { signature, digest } = JSON.parse(message.value);
                  await executeSponsoredTransaction(
                    sponsored,
                    digest,
                    signature,
                  );
                  connection.open && connection.close({ flush: true });
                  open && setOpen(false);
                  onClose(false, digest);
                } else {
                  connection.open && connection.close({ flush: true });
                  open && setOpen(false);
                  onClose(false, message.value);
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
          onClose(true, `Unknown error: ${error}`);
        }
      });

      connection.on('error', (err) => {
        connection.open && connection.close({ flush: true });
        open && setOpen(false);
        onClose(true, `Connection error: ${err.message}`);
      });
    });

    peer.on('error', (err) => {
      open && setOpen(false);
      onClose(true, `Peer error: ${err.message}`);
    });

    return () => {
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <QRCode
            value={peerId}
            logoImage={icon}
            logoPadding={10}
            size={256}
            qrStyle="dots"
            style={{ width: '100%' }}
          />
          <DlgDescription2 mode={mode}>{option.description}</DlgDescription2>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
