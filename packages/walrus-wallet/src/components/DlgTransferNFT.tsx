import React, { useEffect, useState } from 'react';

import { SuiObjectData } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import ReactDOM from 'react-dom/client';
import { HiOutlineCamera, HiOutlineXMark } from 'react-icons/hi2';

import {
  FormField,
  FormInput,
  FormInputButton,
  FormInputWithButton,
  FormLabel,
  FormRoot,
} from './form';
import {
  DlgButton,
  DlgButtonIcon,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { QRScan } from './QRScan';
import { useWalletState } from '../recoil';
import { NotiVariant } from '../utils/types';
import { cleanup } from '../utils/zkLoginSigner';

export const DlgTransferNFT = ({
  object,
  onClose,
  onEvent,
}: {
  object?: SuiObjectData;
  onClose: (isBack: boolean) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const { mode, wallet } = useWalletState();
  const [loading, setLoading] = useState<boolean>(false);
  const [recipient, setRecipient] = useState<string>('');

  const handleScan = () => {
    return new Promise((resolve) => {
      if (wallet) {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);
        root.render(
          <QRScan
            mode={mode}
            wallet={wallet}
            onEvent={onEvent}
            onClose={(result) => {
              cleanup(container, root);
              resolve(result || undefined);
            }}
            scanAddress={(address) => {
              setRecipient(address);
            }}
          />,
        );
      } else {
        onEvent({ variant: 'error', message: 'Wallet not found' });
        resolve(undefined);
      }
    });
  };

  const handleTransfer = async () => {
    if (!wallet || !wallet.address || !recipient || !object) return;

    setLoading(true);
    try {
      const tx = new Transaction();
      tx.transferObjects([tx.object(object.objectId)], recipient);

      await wallet.signAndExecuteTransaction(tx);
      onEvent({
        variant: 'success',
        message: 'NFT Transfer Successful',
      });
    } catch (error) {
      //
    } finally {
      setLoading(false);
      onClose(true);
    }
  };

  useEffect(() => {
    if (!!object) {
      setRecipient('');
      setLoading(false);
    }
  }, [object]);

  return (
    <DlgRoot open={!!object}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContent
          mode={mode}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <DlgTitle mode={mode}>Send NFT</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
            </DlgButtonIcon>
          </div>
          <DlgDescription mode={mode}>
            Enter the recipient address and send the NFT.
          </DlgDescription>

          <FormRoot>
            <FormField name="Recipient Address">
              <FormLabel mode={mode}>Recipient Address</FormLabel>
              <FormInputWithButton mode={mode}>
                <FormInput
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  mode={mode}
                  disabled={loading || !!recipient}
                  placeholder="Enter recipient address"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                  }}
                  style={{ flexGrow: 1, border: 'none' }}
                />
                <FormInputButton
                  mode={mode}
                  onClick={(e) => {
                    e.preventDefault();
                    handleScan();
                  }}
                >
                  <HiOutlineCamera />
                </FormInputButton>
              </FormInputWithButton>
            </FormField>
          </FormRoot>

          <div
            style={{
              display: 'flex',
              marginTop: 16,
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <DlgButton
              mode={mode}
              disabled={!recipient || loading}
              onClick={handleTransfer}
            >
              Send
            </DlgButton>
          </div>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
