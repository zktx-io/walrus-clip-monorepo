import { useCallback, useEffect, useMemo, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
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
import { ClipSigner, NETWORK, NotiVariant } from '../types';
import { makeMessage, parseMessage } from '../utils/message';
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
} from '../utils/sponsoredTransaction';
import {
  connectWithRelayFallback,
  DEFAULT_ICE_CONF,
  loadIceConfig,
  toPeerOptions,
} from '../webrtc/connection';
import { generateRandomId } from '../webrtc/generateRandomId';
import { buildPeerId } from '../webrtc/qr-id';

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
  iceConfigUrl,
}: {
  signer: ClipSigner;
  network: NETWORK;
  destId: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  iceConfigUrl?: string;
}) => {
  const OPEN_TIMEOUT_MS = 8000;
  const destHyphen = destId.replace(/::/g, '-');

  onEvent({ variant: 'info', message: 'Connecting...' });

  void connectWithRelayFallback({
    destIdHyphen: destHyphen,
    iceConfigUrl,
    openTimeoutMs: OPEN_TIMEOUT_MS,
    onEvent,
    onOpen: (conn) => {
      // STEP_0: send address (host will set sender and return bytes)
      conn.send(makeMessage(MessageType.STEP_0, signer.getAddress()));

      conn.on('data', async (data) => {
        try {
          const message = parseMessage(data as string);
          const client = new SuiClient({ url: getFullnodeUrl(network) });

          switch (message.type) {
            case MessageType.STEP_1: {
              // Receive tx bytes (and optional digest if sponsored)
              const { bytes, digest } = JSON.parse(message.value);
              const tx = Transaction.from(fromBase64(bytes));
              const { signature } = await signer.signTransaction(tx);

              // Send back signature (and original bytes)
              conn.send(
                makeMessage(
                  MessageType.STEP_2,
                  JSON.stringify({ txBytes: bytes, signature, digest }),
                ),
              );

              // Wait for message to be sent before closing
              await new Promise((resolve) => setTimeout(resolve, 200));

              if (conn.open) conn.close();

              // Wait for inclusion based on digest
              if (digest) {
                await client.waitForTransaction({
                  digest,
                  options: { showRawEffects: true },
                });
                onEvent({
                  variant: 'success',
                  message: 'Transaction executed',
                });
              } else {
                const computedDigest = await tx.getDigest({ client });
                await client.waitForTransaction({
                  digest: computedDigest,
                  options: { showRawEffects: true },
                });
                onEvent({
                  variant: 'success',
                  message: 'Transaction executed',
                });
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
          onEvent({ variant: 'error', message: String(error) });
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
    },
  }).catch((err) => {
    onEvent({
      variant: 'error',
      message: `Connect init error: ${String(err)}`,
    });
  });
};

/**
 * QR host component: shows QR and waits for the initiator to connect.
 * - If iceConfigUrl is provided, it is embedded into the QR via base64url, and also used locally to load ICE.
 * - If not provided, the default ICE config is used.
 */
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
  option: { title?: string; description?: string; iceConfigUrl?: string };
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: {
    bytes: string;
    signature: string;
    digest: string;
    effects: string;
  }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const [token] = useState<string>(() => generateRandomId());

  // Compose peerId with optional iceConfigUrl suffix so the scanner can use the same ICE config
  const peerId = useMemo(
    () =>
      buildPeerId({
        network,
        token,
        type: 'sign',
        iceConfigUrl: option?.iceConfigUrl,
      }),
    [network, option?.iceConfigUrl, token],
  );
  const peerIdHyphen = useMemo(() => peerId.replace(/::/g, '-'), [peerId]);

  const handleClose = useCallback(
    (
      error?: string,
      result?: {
        bytes: string;
        signature: string;
        digest: string;
        effects: string;
      },
    ) => {
      if (error) onEvent({ variant: 'error', message: error });
      setOpen(false);
      onClose(result);
    },
    [onClose, onEvent],
  );

  useEffect(() => {
    let peer: Peer | undefined;
    let step: string = '';
    let cancelled = false;

    (async () => {
      try {
        // Load ICE config if URL is present; otherwise fallback to default
        const conf = option?.iceConfigUrl
          ? ((await loadIceConfig(option.iceConfigUrl)) ?? DEFAULT_ICE_CONF)
          : DEFAULT_ICE_CONF;
        if (cancelled) return;

        peer = new Peer(peerIdHyphen, toPeerOptions(conf) as any);
        if (cancelled) {
          try {
            peer.destroy();
          } catch {}
          return;
        }

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
                        ? 'Creating sponsored transaction...'
                        : 'Creating transaction...',
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
      } catch (err) {
        if (!cancelled) handleClose(`Peer init error: ${String(err)}`);
      }
    })();

    return () => {
      cancelled = true;
      try {
        peer?.destroy();
      } catch {}
    };
  }, [
    handleClose,
    network,
    onEvent,
    option?.iceConfigUrl,
    peerIdHyphen,
    sponsoredUrl,
    transaction,
  ]);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} />
        <DlgContentQR mode={mode} onOpenAutoFocus={(e) => e.preventDefault()}>
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
