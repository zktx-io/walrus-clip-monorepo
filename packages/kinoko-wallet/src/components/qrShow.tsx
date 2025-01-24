import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';
import { generateRandomness } from '@mysten/sui/zklogin';
import Peer from 'peerjs';
import { QRCode } from 'react-qrcode-logo';

import {
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
  onClose,
}: {
  mode?: 'dark' | 'light';
  option: IDepositOption;
  network: NETWORK;
  sponsored?: string;
  icon: string;
  onClose: (error: boolean, message: string) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = sponsored
    ? `sui-${network}-s-${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}`
    : `sui-${network}-${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}`;

  useEffect(() => {
    const peer = new Peer(peerId);

    peer.on('connection', (connection) => {
      connection.on('data', async (data) => {
        try {
          const message = parseMessage(data as string);
          switch (message.type) {
            case MessageType.STEP_0:
              {
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
                  const { signature, digest } = JSON.parse(message.value);
                  await executeSponsoredTransaction(
                    sponsored,
                    digest,
                    signature,
                  );
                  connection.open && connection.close({ flush: true });
                  setOpen(false);
                  onClose(false, digest);
                } else {
                  connection.open && connection.close({ flush: true });
                  setOpen(false);
                  onClose(false, message.value);
                }
              }
              break;

            default:
              connection.open && connection.close({ flush: true });
              setOpen(false);
              onClose(true, `Unknown message type: ${message.type}`);
          }
        } catch (error) {
          connection.open && connection.close({ flush: true });
          setOpen(false);
          onClose(true, `Unknown error: ${error}`);
        }
      });

      connection.on('error', (err) => {
        connection.open && connection.close({ flush: true });
        setOpen(false);
        onClose(true, `Connection error: ${err.message}`);
      });
    });

    peer.on('error', (err) => {
      setOpen(false);
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
        <DlgOverlay
          mode={mode}
          onClick={() => {
            setOpen(false);
            onClose(true, 'User closed');
          }}
        />
        <DlgContent mode={mode}>
          <DlgTitle mode={mode}>{option.title}</DlgTitle>
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
