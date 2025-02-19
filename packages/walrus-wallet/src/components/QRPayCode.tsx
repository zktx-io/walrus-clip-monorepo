import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
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
  IZkLogin,
  makeMessage,
  NETWORK,
  NotiVariant,
  parseMessage,
} from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

enum MessageType {
  STEP_0 = 'PAY_STEP_0',
  STEP_1 = 'PAY_STEP_1',
  STEP_2 = 'PAY_STEP_2',
}

export const connectQRPay = ({
  wallet,
  destId,
  network,
  address,
  zkLogin,
  setOpen,
  onClose,
  onEvent,
}: {
  wallet: WalletStandard;
  destId: string;
  network: NETWORK;
  address: string;
  zkLogin: IZkLogin;
  setOpen: (open: boolean) => void;
  onClose: (result?: {
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const randomness = generateRandomness();
  const peer = new Peer(randomness);

  onEvent({ variant: 'info', message: 'Connecting...' });
  setOpen(false);

  const handleClose = (error: string) => {
    onEvent({
      variant: 'error',
      message: error,
    });
    onClose();
  };

  peer.on('open', (id) => {
    try {
      const connection = peer.connect(destId.replace(/::/g, '-'));
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
                const { signature } = await wallet.sign(
                  fromBase64(bytes),
                  true,
                );
                if (!!digest) {
                  connection.send(
                    makeMessage(
                      MessageType.STEP_2,
                      JSON.stringify({ txBytes: bytes, signature, digest }),
                    ),
                  );
                  connection.open && connection.close({ flush: true });
                  const { rawEffects } = await client.waitForTransaction({
                    digest,
                    options: {
                      showRawEffects: true,
                    },
                  });
                  onEvent({
                    variant: 'success',
                    message: 'Transaction executed',
                  });
                  onClose({
                    bytes,
                    signature,
                    digest,
                    effects: rawEffects
                      ? toBase64(new Uint8Array(rawEffects))
                      : '',
                  });
                } else {
                  connection.send(
                    makeMessage(
                      MessageType.STEP_2,
                      JSON.stringify({ signature, txBytes: bytes }),
                    ),
                  );
                  const digest = await Transaction.from(
                    fromBase64(bytes),
                  ).getDigest({ client });
                  const { rawEffects } = await client.waitForTransaction({
                    digest,
                    options: {
                      showRawEffects: true,
                    },
                  });
                  onClose({
                    bytes,
                    signature,
                    digest,
                    effects: rawEffects
                      ? toBase64(new Uint8Array(rawEffects))
                      : '',
                  });
                }
              }
              break;

            default:
              connection.open && connection.close({ flush: true });
              handleClose(`Unknown message type: ${message.type}`);
          }
        } catch (error) {
          connection.open && connection.close({ flush: true });
          handleClose(`${error}`);
        }
      });

      connection.on('error', (err) => {
        connection.open && connection.close({ flush: true });
        handleClose(`Connection error: ${err.message}`);
      });
    } catch (error) {
      handleClose(`Failed to establish connection: ${error}`);
    }
  });

  peer.on('error', (err) => {
    handleClose(`Peer error: ${err.message}`);
  });

  return peer;
};

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
  option: {
    title?: string;
    description?: string;
    transaction: Transaction;
  };
  network: NETWORK;
  sponsored?: string;
  icon: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: {
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::transaction`;

  const handleClose = (
    error?: string,
    result?: {
      bytes: string;
      signature: string;
      digest: string;
      effects: string;
    },
  ) => {
    error &&
      onEvent({
        variant: 'error',
        message: error,
      });
    open && setOpen(false);
    onClose(result);
  };

  useEffect(() => {
    const peer = new Peer(peerId.replace(/::/g, '-'));
    let step = '';

    peer.on('connection', (connection) => {
      onEvent({
        variant: 'info',
        message: 'Connecting...',
      });
      setOpen(false);
      connection.on('data', async (data) => {
        try {
          const message = parseMessage(data as string);
          step = message.type;
          const client = new SuiClient({
            url: getFullnodeUrl(network),
          });
          switch (message.type) {
            case MessageType.STEP_0:
              {
                onEvent({
                  variant: 'info',
                  message: 'create sponsored transaction...',
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
                connection.open && connection.close({ flush: true });
                onEvent({
                  variant: 'info',
                  message:
                    sponsored !== undefined
                      ? 'Executing sponsored transaction...'
                      : 'Executing transaction...',
                });

                if (sponsored !== undefined) {
                  const { digest, signature, txBytes } = JSON.parse(
                    message.value,
                  );
                  await executeSponsoredTransaction(
                    sponsored,
                    digest,
                    signature,
                  );
                  const { rawEffects } = await client.waitForTransaction({
                    digest,
                    options: {
                      showRawEffects: true,
                    },
                  });
                  handleClose(undefined, {
                    bytes: txBytes,
                    signature,
                    digest,
                    effects: rawEffects
                      ? toBase64(new Uint8Array(rawEffects))
                      : '',
                  });
                } else {
                  const { signature, txBytes } = JSON.parse(message.value);
                  const { digest } = await client.executeTransactionBlock({
                    transactionBlock: txBytes,
                    signature,
                  });
                  const { rawEffects } = await client.waitForTransaction({
                    digest,
                    options: {
                      showRawEffects: true,
                    },
                  });
                  handleClose(undefined, {
                    bytes: txBytes,
                    signature,
                    digest,
                    effects: rawEffects
                      ? toBase64(new Uint8Array(rawEffects))
                      : '',
                  });
                }
              }
              break;

            default:
              connection.open && connection.close({ flush: true });
              handleClose(`Unknown message type: ${message.type}`);
          }
        } catch (error) {
          connection.open && connection.close({ flush: true });
          handleClose(`Unknown error: ${error}`);
        }
      });

      connection.on('error', (err) => {
        connection.open && connection.close({ flush: true });
        handleClose(`Connection error: ${err.message}`);
      });

      connection.on('close', () => {
        step !== MessageType.STEP_2 &&
          handleClose('Connection closed by the remote peer.');
      });
    });

    peer.on('error', (err) => {
      handleClose(`Peer error: ${err.message}`);
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
                handleClose('User closed');
              }}
            >
              <Cross2Icon />
            </DlgClose>
          </div>
          <QRCode
            value={peerId}
            logoImage={icon}
            logoPadding={5}
            size={256}
            qrStyle="dots"
            style={{ width: '256px', height: '256px' }}
          />
          <DlgDescription2 mode={mode}>{option.description}</DlgDescription2>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
