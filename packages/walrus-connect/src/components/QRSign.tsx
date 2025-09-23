import { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { generateRandomness } from '@mysten/sui/zklogin';
import { X } from 'lucide-react';
import Peer from 'peerjs';
import { QRCode } from 'react-qrcode-logo';

import {
  DlgButtonIcon,
  DlgContentQR,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { PEER_CONFIG } from '../config';
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import { makeMessage, parseMessage } from '../utils/message';
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
} from '../utils/sponsoredTransaction';

enum MessageType {
  STEP_0 = 'SIGN_STEP_0',
  STEP_1 = 'SIGN_STEP_1',
  STEP_2 = 'SIGN_STEP_2',
}

export const connectQRSign = ({
  signer,
  network,
  destId,
  onEvent,
}: {
  signer: ClipSigner;
  network: NETWORK;
  destId: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const randomness = generateRandomness();
  const peer = new Peer(randomness, PEER_CONFIG);

  onEvent({ variant: 'info', message: 'Connecting...' });

  const handleClose = (error?: string) => {
    if (error) {
      onEvent({
        variant: 'error',
        message: error,
      });
    }
    peer.destroy();
  };

  peer.on('open', (id) => {
    try {
      const address = signer.getAddress();
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
                const { signature } = await signer.signTransaction(
                  Transaction.from(bytes),
                );
                connection.send(
                  makeMessage(
                    MessageType.STEP_2,
                    JSON.stringify({ txBytes: bytes, signature, digest }),
                  ),
                );
                connection.open && connection.close({ flush: true });
                if (digest) {
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
                  handleClose();
                } else {
                  const digest = await Transaction.from(
                    fromBase64(bytes),
                  ).getDigest({ client });
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
                  handleClose();
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
};

export const QRSign = ({
  mode,
  data: { network, transaction, sponsoredUrl },
  icon,
  option,
  onEvent,
  onClose,
}: {
  mode: 'dark' | 'light';
  data: {
    network: NETWORK;
    transaction: {
      toJSON: () => Promise<string>;
    };
    sponsoredUrl?: string;
  };
  icon: string;
  option: {
    title?: string;
    description?: string;
  };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: {
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::sign`;

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
    const peer = new Peer(peerId.replace(/::/g, '-'), PEER_CONFIG);
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
                if (sponsoredUrl !== undefined) {
                  onEvent({
                    variant: 'info',
                    message: 'create sponsored transaction...',
                  });
                } else {
                  onEvent({
                    variant: 'info',
                    message: 'create transaction...',
                  });
                }

                const txb = Transaction.from(await transaction.toJSON());
                txb.setSenderIfNotSet(message.value);

                if (sponsoredUrl !== undefined) {
                  const txBytes = await txb.build({
                    client,
                    onlyTransactionKind: true,
                  });
                  const { bytes: sponsoredTxBytes, digest } =
                    await createSponsoredTransaction(
                      sponsoredUrl,
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
                  const txBytes = await txb.build({
                    client,
                  });
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
                    sponsoredUrl !== undefined
                      ? 'Executing sponsored transaction...'
                      : 'Executing transaction...',
                });
                if (sponsoredUrl !== undefined) {
                  const { digest, signature, txBytes } = JSON.parse(
                    message.value,
                  );
                  await executeSponsoredTransaction(
                    sponsoredUrl,
                    digest!,
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
            <DlgTitle mode={mode}>{option.title}</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => {
                handleClose('User closed');
              }}
            >
              <X />
            </DlgButtonIcon>
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
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
