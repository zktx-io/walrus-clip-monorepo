import React, { useCallback, useState } from 'react';

import { IDetectedBarcode, Scanner } from '@yudiel/react-qr-scanner';
import { ScanQrCode, X } from 'lucide-react';

import { FormInputButton } from './form';
import {
  DlgButtonIcon,
  DlgContentQR,
  DlgDescription2,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  DlgTrigger,
} from './modal';

export const QRAddressScan = ({
  mode,
  onClose,
}: {
  mode: 'dark' | 'light';
  onClose: (address: string) => void;
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleScan = useCallback(
    (result: IDetectedBarcode[]) => {
      const first = result?.[0];
      if (!first) return;
      if (first.format === 'qr_code') {
        onClose(first.rawValue);
        setOpen(false);
      } else {
        setError('Invalid QR code');
      }
    },
    [onClose],
  );

  return (
    <DlgRoot open={open}>
      <DlgTrigger asChild>
        <FormInputButton
          mode={mode}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
        >
          <ScanQrCode />
        </FormInputButton>
      </DlgTrigger>
      <DlgPortal>
        <DlgOverlay
          mode={mode}
          onClick={() => {
            setOpen(false);
          }}
        />
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
            <DlgTitle mode={mode}>Scan</DlgTitle>
            <DlgButtonIcon
              mode={mode}
              onClick={() => {
                setOpen(false);
              }}
            >
              <X />
            </DlgButtonIcon>
          </div>
          <div
            style={{ position: 'relative', width: '100%', marginTop: '12px' }}
          >
            <Scanner
              styles={{
                container: { width: '256px', height: '256px' },
                video: { width: '256px', height: '256px' },
              }}
              formats={['qr_code']}
              onScan={handleScan}
              onError={(error) => {
                setError(`${error}`);
              }}
            />
          </div>
          <DlgDescription2 mode={mode}>
            {error ? error : 'Please scan the QR code.'}
          </DlgDescription2>
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
