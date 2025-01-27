import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { generateRandomness } from '@mysten/sui/zklogin';
import { Cross2Icon } from '@radix-ui/react-icons';
import Peer from 'peerjs';
import { QRCode } from 'react-qrcode-logo';

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

interface IQRPayCodeOption {
  title?: string;
  description?: string;
  transaction: Transaction;
}

export const QRPayCode = ({
  mode = 'light',
  option,
  network,
  sponsored,
  icon,
  onEvent,
  onClose,
}: {
  mode?: 'dark' | 'light';
  option: IQRPayCodeOption;
  network: NETWORK;
  sponsored?: string;
  icon: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result: string | { digest: string; effects: string }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = sponsored
    ? `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::ts`
    : `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::tx`;

  useEffect(() => {
    const peer = new Peer(peerId.replace(/::/g, '-'));

    peer.on('connection', (connection) => {
      connection.on('data', async (data) => {
        try {
          const message = parseMessage(data as string);
          const client = new SuiClient({
            url: getFullnodeUrl(network),
          });
          switch (message.type) {
            case MessageType.STEP_0:
              {
                onEvent({
                  variant: 'info',
                  message: 'Connecting...',
                });
                setOpen(false);
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
                  connection.open && connection.close({ flush: true });
                  open && setOpen(false);
                  onClose(message.value);
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
          onClose(`Unknown error: ${error}`);
        }
      });

      connection.on('error', (err) => {
        connection.open && connection.close({ flush: true });
        open && setOpen(false);
        onClose(`Connection error: ${err.message}`);
      });
    });

    peer.on('error', (err) => {
      open && setOpen(false);
      onClose(`Peer error: ${err.message}`);
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
                onClose('User closed');
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
