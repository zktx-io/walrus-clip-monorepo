import React, { useState } from 'react';

import { QRCode } from 'react-qrcode-logo';

import {
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  Mode,
} from './modal';

export const QRAddress = ({
  mode,
  address,
  open,
  onClose,
  icon,
}: {
  mode?: Mode;
  address?: string;
  open: boolean;
  onClose: () => void;
  icon: string;
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <DlgRoot open={open && !!address}>
      <DlgPortal>
        <DlgOverlay
          mode={mode}
          onClick={() => {
            onClose();
          }}
        />
        <DlgContent
          mode={mode}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DlgTitle mode={mode}>Your Sui Address</DlgTitle>
          <div
            onClick={copyToClipboard}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 0.2s ease-in-out',
              maxWidth: '250px',
            }}
          >
            <DlgDescription
              mode={mode}
              title={address}
              style={{
                flexGrow: 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                textAlign: 'center',
              }}
            >
              {copied ? 'Copied!' : address}
            </DlgDescription>
          </div>
          <QRCode
            value={address}
            logoImage={icon}
            logoPadding={5}
            size={256}
            qrStyle="dots"
            style={{ width: '256px', height: '256px' }}
          />
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
