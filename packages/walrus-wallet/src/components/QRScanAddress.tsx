import React, { useCallback, useState } from 'react';

import { IDetectedBarcode, Scanner } from '@yudiel/react-qr-scanner';
import { HiOutlineCamera, HiOutlineXMark } from 'react-icons/hi2';

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
import { useWalletState } from '../recoil';
import { FormInputButton } from './form';

export const QRScanAddress = ({
  scanAddress,
}: {
  scanAddress: (address: string) => void;
}) => {
  const { mode } = useWalletState();
  const [open, setOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleScan = useCallback(
    (result: IDetectedBarcode[]) => {
      if (result[0].format === 'qr_code') {
        scanAddress(result[0].rawValue);
        setOpen(false);
      } else {
        setError('Invalid QR code');
      }
    },
    [scanAddress],
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
          <HiOutlineCamera />
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
              <HiOutlineXMark />
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
