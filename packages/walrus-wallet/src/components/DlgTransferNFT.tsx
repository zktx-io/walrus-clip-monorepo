import { useEffect, useState } from 'react';

import { SuiObjectData } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  DlgButton,
  DlgButtonIcon,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  FormField,
  FormInput,
  FormInputWithButton,
  FormLabel,
  FormRoot,
  NotiVariant,
  QRAddressScan,
} from '@zktx.io/walrus-connect';
import { X } from 'lucide-react';

import { useWalletState } from '../recoil';
import { isSuiAddress } from '../utils/utils';

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
  const [errorMsg, setErrorMsg] = useState<string>('');

  const validateRecipient = (value: string) => {
    if (!value) {
      setErrorMsg('');
      return false;
    }
    if (!isSuiAddress(value)) {
      setErrorMsg('Invalid Sui address');
      return false;
    }
    setErrorMsg('');
    return true;
  };

  const handleRecipientChange = (value: string) => {
    setRecipient(value);
    validateRecipient(value);
  };

  const handleTransfer = async () => {
    if (!wallet || !wallet.address || !object) return;
    if (!validateRecipient(recipient)) return;

    setLoading(true);
    try {
      const tx = new Transaction();
      tx.transferObjects([tx.object(object.objectId)], recipient);
      await wallet.signAndExecuteTransaction(tx);
      onEvent({ variant: 'success', message: 'NFT Transfer Successful' });
    } catch (err) {
      onEvent({ variant: 'error', message: String(err) });
    } finally {
      setLoading(false);
      onClose(true);
    }
  };

  useEffect(() => {
    if (object) {
      setRecipient('');
      setErrorMsg('');
      setLoading(false);
    }
  }, [object]);

  const isSendDisabled = !recipient || !!errorMsg || loading;

  return (
    <DlgRoot open={!!object}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContent
          mode={mode}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="transfer-header">
            <DlgTitle mode={mode}>Transfer NFT</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => onClose(true)}
              aria-label="Close"
            >
              <X />
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
                  disabled={loading}
                  placeholder="Enter recipient address"
                  value={recipient}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className="transfernft-input-grow"
                  aria-label="Recipient address"
                />
                <QRAddressScan
                  mode={mode}
                  onClose={(addr) => handleRecipientChange(addr)}
                />
              </FormInputWithButton>
            </FormField>
          </FormRoot>

          <div className="transfer-actions">
            <div
              className="transfer-error"
              data-mode={mode}
              role="alert"
              aria-live="polite"
            >
              {errorMsg}
            </div>
            <DlgButton
              mode={mode}
              disabled={isSendDisabled}
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
