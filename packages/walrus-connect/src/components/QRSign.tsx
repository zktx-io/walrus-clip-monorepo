import { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { X } from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';
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
import { PEER_CONFIG, PEER_CONFIG_RELAY } from '../config';
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import { generateRandomId } from '../utils/generateRandomId';
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
  const OPEN_TIMEOUT_MS = 8000;

  const attachDebug = (conn: DataConnection) => {
    const pc = (conn as any)?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;
    pc.addEventListener('iceconnectionstatechange', () => {
      onEvent({ variant: 'info', message: `ICE: ${pc.iceConnectionState}` });
    });
    pc.addEventListener('connectionstatechange', () => {
      onEvent({ variant: 'info', message: `PC: ${pc.connectionState}` });
    });
  };

  const tryConnect = (peer: Peer, dest: string, useRelayFallback: boolean) => {
    const conn = peer.connect(dest);
    attachDebug(conn);

    const timer = setTimeout(() => {
      if (!conn.open && !useRelayFallback) {
        try {
          conn.close();
        } catch {}
        onEvent({
          variant: 'warning',
          message: 'Direct P2P failed. Retrying via TURN relay…',
        });
        const p2 = new Peer(generateRandomId(), PEER_CONFIG_RELAY as any);
        p2.on('open', () => tryConnect(p2, dest, true));
        p2.on('error', (err) =>
          onEvent({ variant: 'error', message: `Peer error: ${err.message}` }),
        );
      }
    }, OPEN_TIMEOUT_MS);

    conn.on('open', () => {
      clearTimeout(timer);
      conn.send(makeMessage(MessageType.STEP_0, signer.getAddress()));
    });

    conn.on('data', async (data) => {
      try {
        const message = parseMessage(data as string);
        const client = new SuiClient({ url: getFullnodeUrl(network) });

        switch (message.type) {
          case MessageType.STEP_1: {
            const { bytes, digest } = JSON.parse(message.value);
            const tx = Transaction.from(fromBase64(bytes));
            const { signature } = await signer.signTransaction(tx);

            conn.send(
              makeMessage(
                MessageType.STEP_2,
                JSON.stringify({ txBytes: bytes, signature, digest }),
              ),
            );

            if (conn.open) conn.close();

            if (digest) {
              await client.waitForTransaction({
                digest,
                options: { showRawEffects: true },
              });
              onEvent({ variant: 'success', message: 'Transaction executed' });
            } else {
              const computedDigest = await tx.getDigest({ client });
              await client.waitForTransaction({
                digest: computedDigest,
                options: { showRawEffects: true },
              });
              onEvent({ variant: 'success', message: 'Transaction executed' });
            }
            break;
          }
          default: {
            if (conn.open) conn.close();
            onEvent({
              variant: 'error',
              message: `Unknown message type: ${message.type}`,
            });
          }
        }
      } catch (error) {
        try {
          if ((conn as any).open) (conn as any).close();
        } catch {}
        onEvent({ variant: 'error', message: `${error}` });
      }
    });

    conn.on('error', (err) => {
      try {
        if (conn.open) conn.close();
      } catch {}
      onEvent({
        variant: 'error',
        message: `Connection error: ${err.message}`,
      });
    });
  };

  const localId = generateRandomId();
  const peer = new Peer(localId, PEER_CONFIG as any);
  const dest = destId.replace(/::/g, '-');

  onEvent({ variant: 'info', message: 'Connecting...' });

  const handleClose = (error?: string) => {
    if (error) onEvent({ variant: 'error', message: error });
    try {
      peer.destroy();
    } catch {}
  };

  peer.on('open', () => {
    tryConnect(peer, dest, /*useRelayFallback=*/ false);
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
    transaction: { toJSON: () => Promise<string> };
    sponsoredUrl?: string;
  };
  icon: string;
  option: { title?: string; description?: string };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: {
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const rand = crypto.getRandomValues(new Uint8Array(16));
  const peerToken = Array.from(rand)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const peerId = `sui::${network}::${peerToken}::sign`;

  const handleClose = (
    error?: string,
    result?: {
      bytes: string;
      signature: string;
      digest: string;
      effects: string;
    },
  ) => {
    if (error) onEvent({ variant: 'error', message: error });
    if (open) setOpen(false);
    onClose(result);
  };

  useEffect(() => {
    const peer = new Peer(peerId.replace(/::/g, '-'), PEER_CONFIG as any);
    let step: string = '';

    peer.on('connection', (connection) => {
      onEvent({ variant: 'info', message: 'Connecting...' });
      setOpen(false);

      connection.on('data', async (data) => {
        try {
          const message = parseMessage(data as string);
          step = message.type;

          const client = new SuiClient({ url: getFullnodeUrl(network) });

          switch (message.type) {
            case MessageType.STEP_0: {
              onEvent({
                variant: 'info',
                message:
                  sponsoredUrl !== undefined
                    ? 'create sponsored transaction...'
                    : 'create transaction...',
              });

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
                const txBytes = await txb.build({ client });
                connection.send(
                  makeMessage(
                    MessageType.STEP_1,
                    JSON.stringify({ bytes: toBase64(txBytes) }),
                  ),
                );
              }
              break;
            }

            case MessageType.STEP_2: {
              if (connection.open) connection.close();

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
                  options: { showRawEffects: true },
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
                  options: { showRawEffects: true },
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
              break;
            }

            default: {
              if (connection.open) connection.close();
              handleClose(`Unknown message type: ${message.type}`);
            }
          }
        } catch (error) {
          if ((connection as any).open) (connection as any).close();
          handleClose(`Unknown error: ${error}`);
        }
      });

      connection.on('error', (err) => {
        if (connection.open) connection.close();
        handleClose(`Connection error: ${err.message}`);
      });

      connection.on('close', () => {
        if (step !== MessageType.STEP_2) {
          handleClose('Connection closed by the remote peer.');
        }
      });
    });

    peer.on('error', (err) => {
      handleClose(`Peer error: ${err.message}`);
    });

    return () => {
      try {
        peer.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} />
        <DlgContentQR
          mode={mode}
          onOpenAutoFocus={(event) => event.preventDefault()}
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
              onClick={() => handleClose('User closed')}
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
