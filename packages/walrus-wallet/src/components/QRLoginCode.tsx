import React, { useEffect, useState } from 'react';

import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { fromBase64 } from '@mysten/sui/utils';
import {
  generateRandomness,
  toZkLoginPublicIdentifier,
  ZkLoginPublicIdentifier,
} from '@mysten/sui/zklogin';
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
  IZkLogin,
  makeMessage,
  NETWORK,
  NotiVariant,
  parseMessage,
} from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

enum MessageType {
  STEP_0 = 'LOGIN_STEP_0',
  STEP_1 = 'LOGIN_STEP_1',
}

export const connectQRLogin = ({
  wallet,
  destId,
  address,
  zkLogin,
  setOpen,
  onClose,
  onEvent,
}: {
  wallet: WalletStandard;
  destId: string;
  address: string;
  zkLogin: IZkLogin;
  setOpen: (open: boolean) => void;
  onClose: () => void;
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
      const encoder = new TextEncoder();

      connection.on('open', async () => {
        try {
          const { signature } = await wallet.sign(
            encoder.encode(destId),
            false,
          );
          const publicKey = toZkLoginPublicIdentifier(
            BigInt(zkLogin.proofInfo.addressSeed),
            zkLogin.proofInfo.iss,
          ).toSuiPublicKey();
          connection.send(
            makeMessage(
              MessageType.STEP_0,
              JSON.stringify({ address, publicKey, signature }),
            ),
          );
        } catch (error) {
          onEvent({ variant: 'error', message: `${error}` });
          onClose();
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
              onClose();
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

export const QRLoginCode = ({
  mode = 'light',
  network,
  icon,
  onClose,
  onEvent,
}: {
  mode?: 'dark' | 'light';
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
          switch (message.type) {
            case MessageType.STEP_0:
              {
                onEvent({
                  variant: 'info',
                  message: 'verifing...',
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
                  const zkLoginPublicIdentifier = new ZkLoginPublicIdentifier(
                    fromBase64(publicKey),
                    { client },
                  );
                  const encoder = new TextEncoder();
                  const result =
                    await zkLoginPublicIdentifier.verifyPersonalMessage(
                      encoder.encode(peerId),
                      fromBase64(signature),
                    );
                  if (result) {
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
            <DlgTitle mode={mode}>Login</DlgTitle>
            <DlgClose
              mode={mode}
              onClick={() => {
                handleClose('Login canceled');
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
          <DlgDescription2 mode={mode}>
            Please scan the QR code to log in.
          </DlgDescription2>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
