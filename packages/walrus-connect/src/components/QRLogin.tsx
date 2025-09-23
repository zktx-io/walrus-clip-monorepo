import { useEffect, useState } from 'react';

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { PasskeyPublicKey } from '@mysten/sui/keypairs/passkey';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { MultiSigPublicKey } from '@mysten/sui/multisig';
import { fromBase64 } from '@mysten/sui/utils';
import {
  generateRandomness,
  ZkLoginPublicIdentifier,
} from '@mysten/sui/zklogin';
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

enum MessageType {
  STEP_0 = 'LOGIN_STEP_0',
  STEP_1 = 'LOGIN_STEP_1',
}

export const connectQRLogin = ({
  signer,
  destId,
  onEvent,
}: {
  signer: ClipSigner;
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
      const encoder = new TextEncoder();

      connection.on('open', async () => {
        try {
          const { signature } = await signer.signPersonalMessage(
            encoder.encode(destId),
          );
          const publicKey = signer.getPublicKey().toSuiPublicKey();
          connection.send(
            makeMessage(
              MessageType.STEP_0,
              JSON.stringify({ address, publicKey, signature }),
            ),
          );
        } catch (error) {
          onEvent({ variant: 'error', message: `${error}` });
          handleClose();
        }
      });

      connection.on('data', (data) => {
        try {
          const message = parseMessage(data as string);
          switch (message.type) {
            case MessageType.STEP_1:
              if (message.value === 'OK') {
                onEvent({ variant: 'success', message: 'Connected' });
              } else {
                onEvent({ variant: 'error', message: message.value });
              }
              handleClose();
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

export const QRLogin = ({
  mode,
  network,
  icon,
  onClose,
  onEvent,
}: {
  mode: 'dark' | 'light';
  network: NETWORK;
  icon: string;
  onClose: (result?: { address: string; network: NETWORK }) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::login`;

  const handleClose = (
    error?: string,
    result?: { address: string; network: NETWORK },
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
          switch (message.type) {
            case MessageType.STEP_0:
              {
                onEvent({
                  variant: 'info',
                  message: 'verifying...',
                });
                try {
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
                        {
                          client,
                        },
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    case 0x06:
                      verification = await new PasskeyPublicKey(
                        bytesPublicKey.slice(1),
                      ).verifyPersonalMessage(bytesMessage, signature);
                      break;
                    default:
                      break;
                  }
                  if (verification) {
                    connection.send(makeMessage(MessageType.STEP_1, 'OK'));
                    onEvent({
                      variant: 'success',
                      message: 'verification success',
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
        step !== MessageType.STEP_0 &&
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
        <DlgOverlay mode={mode} style={{ zIndex: 2147483645 }} />
        <DlgContentQR
          mode={mode}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
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
              onClick={() => {
                handleClose('Login canceled');
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
          <DlgDescription2 mode={mode}>
            Please scan the QR code to log in.
          </DlgDescription2>
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
