import { useEffect, useState } from 'react';

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { PasskeyPublicKey } from '@mysten/sui/keypairs/passkey';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { fromBase64 } from '@mysten/sui/utils';
import { ZkLoginPublicIdentifier } from '@mysten/sui/zklogin';
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
  connectWithRelayFallback,
  DEFAULT_ICE_CONF,
  loadIceConfig,
  toPeerOptions,
} from '../webrtc/connection';
import { generateRandomId } from '../webrtc/generateRandomId';
import { buildPeerId } from '../webrtc/qr-id';

enum MessageType {
  STEP_0 = 'LOGIN_STEP_0',
  STEP_1 = 'LOGIN_STEP_1',
}

/**
 * Initiator (scanner) connector: connects to the QR host's peerId.
 * If iceConfigUrl is provided (decoded from QR), it loads ICE from there; else uses default.
 * Falls back to relay-only if direct P2P opening times out.
 */
export const connectQRLogin = ({
  signer,
  destId,
  onEvent,
  iceConfigUrl,
}: {
  signer: ClipSigner;
  destId: string; // canonical "sui::<network>::<token>::login[::<b64url(url)>]"
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  iceConfigUrl?: string; // optional ICE config base url
}) => {
  const OPEN_TIMEOUT_MS = 8000;
  const destHyphen = destId.replace(/::/g, '-');

  onEvent({ variant: 'info', message: 'Connecting...' });

  // Use shared connector with relay fallback behavior
  connectWithRelayFallback({
    destIdHyphen: destHyphen,
    iceConfigUrl,
    openTimeoutMs: OPEN_TIMEOUT_MS,
    onEvent,
    onOpen: (conn) => {
      // When connection opens, prove liveness/ownership by signing the destId string.
      (async () => {
        try {
          const encoder = new TextEncoder();
          const { signature } = await signer.signPersonalMessage(
            encoder.encode(destId),
          );
          const publicKey = signer.getPublicKey().toSuiPublicKey();

          conn.send(
            makeMessage(
              MessageType.STEP_0,
              JSON.stringify({
                address: signer.getAddress(),
                publicKey,
                signature,
              }),
            ),
          );
        } catch (error) {
          onEvent({ variant: 'error', message: String(error) });
          try {
            conn.close();
          } catch {}
        }
      })();

      conn.on('data', (data) => {
        try {
          const message = parseMessage(data as string);
          switch (message.type) {
            case MessageType.STEP_1: {
              if (message.value === 'OK') {
                onEvent({ variant: 'success', message: 'Connected' });
              } else {
                onEvent({ variant: 'error', message: message.value });
              }
              try {
                conn.close();
              } catch {}
              break;
            }
            default: {
              try {
                conn.close();
              } catch {}
              onEvent({
                variant: 'error',
                message: `Unknown message type: ${message.type}`,
              });
            }
          }
        } catch (error) {
          try {
            conn.close();
          } catch {}
          onEvent({ variant: 'error', message: String(error) });
        }
      });

      conn.on('error', (err) => {
        try {
          conn.close();
        } catch {}
        onEvent({
          variant: 'error',
          message: `Connection error: ${err.message}`,
        });
      });
    },
  });
};

/**
 * QR host component: shows QR and waits for the initiator to connect.
 * - If iceConfigUrl is provided, it is embedded into the QR via base64url, and also used locally to load ICE.
 * - If not provided, the default ICE config is used.
 */
export const QRLogin = ({
  mode,
  network,
  icon,
  onClose,
  onEvent,
  iceConfigUrl,
}: {
  mode: 'dark' | 'light';
  network: NETWORK;
  icon: string;
  onClose: (result?: { address: string; network: NETWORK }) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  /** Optional: when provided, embed this URL into the QR and load ICE from `{url}/ice-conf.json` */
  iceConfigUrl?: string;
}) => {
  const [open, setOpen] = useState<boolean>(true);

  // Compose peerId with optional iceConfigUrl suffix so the scanner can use the same ICE config
  const token = generateRandomId();
  const peerId = buildPeerId({
    network,
    token,
    type: 'login',
    iceConfigUrl,
  });
  const peerIdHyphen = peerId.replace(/::/g, '-');

  const handleClose = (
    error?: string,
    result?: { address: string; network: NETWORK },
  ) => {
    if (error) onEvent({ variant: 'error', message: error });
    if (open) setOpen(false);
    onClose(result);
  };

  useEffect(() => {
    let peer: Peer | undefined;
    let step = '';

    (async () => {
      // Load ICE config for the local listener
      const conf = iceConfigUrl
        ? ((await loadIceConfig(iceConfigUrl)) ?? DEFAULT_ICE_CONF)
        : DEFAULT_ICE_CONF;

      peer = new Peer(peerIdHyphen, toPeerOptions(conf) as any);

      peer.on('connection', (connection) => {
        onEvent({ variant: 'info', message: 'Connecting...' });
        setOpen(false);

        connection.on('data', async (data) => {
          try {
            const message = parseMessage(data as string);
            step = message.type;

            switch (message.type) {
              case MessageType.STEP_0: {
                onEvent({ variant: 'info', message: 'Verifying...' });
                try {
                  // zkLogin verification needs GQL client
                  const client = new SuiGraphQLClient({
                    url: `https://sui-${network}.mystenlabs.com/graphql`,
                  });

                  const {
                    address,
                    publicKey,
                    signature,
                  }: { address: string; publicKey: string; signature: string } =
                    JSON.parse(message.value);

                  const bytesPublicKey = fromBase64(publicKey);
                  const bytesMessage = new TextEncoder().encode(peerId);
                  let verification = false;

                  // First byte determines the key scheme
                  switch (bytesPublicKey[0]) {
                    case 0x00:
                      verification = await new Ed25519PublicKey(
                        bytesPublicKey.slice(1),
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    case 0x01:
                      verification = await new Secp256k1PublicKey(
                        bytesPublicKey.slice(1),
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    case 0x02:
                      verification = await new Secp256r1PublicKey(
                        bytesPublicKey.slice(1),
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    case 0x03:
                      verification = await new MultiSigPublicKey(
                        bytesPublicKey.slice(1),
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    case 0x05:
                      verification = await new ZkLoginPublicIdentifier(
                        bytesPublicKey.slice(1),
                        { client },
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    case 0x06:
                      verification = await new PasskeyPublicKey(
                        bytesPublicKey.slice(1),
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    default:
                      verification = false;
                  }

                  if (verification) {
                    connection.send(makeMessage(MessageType.STEP_1, 'OK'));
                    onEvent({
                      variant: 'success',
                      message: 'Verification success',
                    });
                    handleClose(undefined, { address, network });
                  } else {
                    connection.send(
                      makeMessage(MessageType.STEP_1, 'verification failed'),
                    );
                    handleClose('verification failed');
                  }
                } catch (error) {
                  connection.send(
                    makeMessage(MessageType.STEP_1, `error: ${error}`),
                  );
                  handleClose(`error: ${error}`);
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
          if (step !== MessageType.STEP_0) {
            handleClose('Connection closed by the remote peer.');
          }
        });
      });

      peer.on('error', (err) => {
        handleClose(`Peer error: ${err.message}`);
      });
    })();

    return () => {
      try {
        peer?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} style={{ zIndex: 2147483645 }} />
        <DlgContentQR
          mode={mode}
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={{ zIndex: 2147483645 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <DlgTitle mode={mode}>Login</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => handleClose('Login canceled')}
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
          <DlgDescription2 mode={mode}>
            Please scan the QR code to log in.
          </DlgDescription2>
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
