import React, { useEffect, useState } from 'react';

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64, toBase64 } from '@mysten/sui/utils';
import { generateRandomness } from '@mysten/sui/zklogin';
import Peer from 'peerjs';
import { HiOutlineXMark } from 'react-icons/hi2';
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
import {
  createSponsoredTransaction,
  executeSponsoredTransaction,
} from '../utils/sponsoredTransaction';
import {
  makeMessage,
  NETWORK,
  NotiVariant,
  parseMessage,
} from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

enum MessageType {
  STEP_0 = 'SIGN_STEP_0',
  STEP_1 = 'SIGN_STEP_1',
  STEP_2 = 'SIGN_STEP_2',
}

export interface TxResult {
  bytes: string;
  signature: string;
  digest: string;
  effects: string;
}

export const connectQRSign = ({
  wallet,
  destId,
  setOpen,
  onClose,
  onEvent,
}: {
  wallet: WalletStandard;
  destId: string;
  setOpen: (open: boolean) => void;
  onClose: (result?: TxResult[]) => void;
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
    if (!!wallet.signer) {
      try {
        const signer = wallet.signer;
        const address = signer.toSuiAddress();
        const connection = peer.connect(destId.replace(/::/g, '-'));

        connection.on('open', () => {
          connection.send(makeMessage(MessageType.STEP_0, address));
        });
        connection.on('data', async (data) => {
          try {
            const message = parseMessage(data as string);
            const client = new SuiClient({
              url: getFullnodeUrl(signer.network),
            });
            switch (message.type) {
              case MessageType.STEP_1:
                {
                  const { txs } = JSON.parse(message.value) as {
                    txs: { bytes: string; digest?: string }[];
                  };
                  const signatures = await signer.signMultiTx(
                    txs.map(({ bytes }) => fromBase64(bytes)),
                  );
                  const txsTemp = txs.map((item, index) => ({
                    ...item,
                    signature: signatures[index].signature,
                  }));
                  connection.send(
                    makeMessage(
                      MessageType.STEP_2,
                      JSON.stringify({
                        txs: txsTemp,
                      }),
                    ),
                  );
                  connection.open && connection.close({ flush: true });
                  const txResult: TxResult[] = [];
                  for (const tx of txsTemp) {
                    const digest = tx.digest
                      ? tx.digest
                      : await Transaction.from(fromBase64(tx.bytes)).getDigest({
                          client,
                        });
                    const { rawEffects } = await client.waitForTransaction({
                      digest,
                      options: {
                        showRawEffects: true,
                      },
                    });
                    txResult.push({
                      bytes: tx.bytes,
                      signature: tx.signature,
                      digest,
                      effects: rawEffects
                        ? toBase64(new Uint8Array(rawEffects))
                        : '',
                    });
                  }
                  onEvent({
                    variant: 'success',
                    message: 'Transaction executed',
                  });
                  onClose(txResult);
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
    } else {
      handleClose('Wallet signer not initialized');
    }
  });

  peer.on('error', (err) => {
    handleClose(`Peer error: ${err.message}`);
  });

  return peer;
};

export const QRSignCode = ({
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
    transactions: Transaction[];
  };
  network: NETWORK;
  sponsored?: string;
  icon: string;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onClose: (result?: TxResult[]) => void;
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const peerId = `sui::${network}::${parseInt(generateRandomness(), 10).toString(16).replace(/0+$/, '')}::sign`;

  const handleClose = (error?: string, result?: TxResult[]) => {
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
                if (sponsored !== undefined) {
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
                const txBytes: Uint8Array[] = [];
                for (const tx of option.transactions) {
                  tx.setSenderIfNotSet(message.value);
                  txBytes.push(
                    await tx.build({
                      client,
                      ...(sponsored !== undefined && {
                        onlyTransactionKind: true,
                      }),
                    }),
                  );
                }
                if (sponsored !== undefined) {
                  const txs: { bytes: string; digest: string }[] = [];
                  for (const tx of txBytes) {
                    txs.push(
                      await createSponsoredTransaction(
                        sponsored,
                        network,
                        message.value,
                        tx,
                      ),
                    );
                  }
                  connection.send(
                    makeMessage(MessageType.STEP_1, JSON.stringify({ txs })),
                  );
                } else {
                  connection.send(
                    makeMessage(
                      MessageType.STEP_1,
                      JSON.stringify({
                        txs: txBytes.map((item) => ({ bytes: toBase64(item) })),
                      }),
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
                const txResult: TxResult[] = [];
                const { txs } = JSON.parse(message.value) as {
                  txs: {
                    digest?: string;
                    signature: string;
                    bytes: string;
                  }[];
                };
                if (sponsored !== undefined) {
                  for (const tx of txs) {
                    await executeSponsoredTransaction(
                      sponsored,
                      tx.digest!,
                      tx.signature,
                    );
                    const { rawEffects } = await client.waitForTransaction({
                      digest: tx.digest!,
                      options: {
                        showRawEffects: true,
                      },
                    });
                    txResult.push({
                      bytes: tx.bytes,
                      signature: tx.signature,
                      digest: tx.digest!,
                      effects: rawEffects
                        ? toBase64(new Uint8Array(rawEffects))
                        : '',
                    });
                  }
                } else {
                  for (const tx of txs) {
                    const { digest } = await client.executeTransactionBlock({
                      transactionBlock: tx.bytes,
                      signature: tx.signature,
                    });
                    const { rawEffects } = await client.waitForTransaction({
                      digest,
                      options: {
                        showRawEffects: true,
                      },
                    });
                    txResult.push({
                      bytes: tx.bytes,
                      signature: tx.signature,
                      digest,
                      effects: rawEffects
                        ? toBase64(new Uint8Array(rawEffects))
                        : '',
                    });
                  }
                }
                handleClose(undefined, txResult);
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
              <HiOutlineXMark />
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
