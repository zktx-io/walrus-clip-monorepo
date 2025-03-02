import React, { useState } from 'react';

import { QRCode } from 'react-qrcode-logo';

import {
  DlgContentQR,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';

export const QRAddress = ({
  open,
  onClose,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  icon: string;
}) => {
  const { mode, wallet } = useWalletState();
  const [copied, setCopied] = useState<boolean>(false);

  const copyToClipboard = () => {
    if (wallet?.address) {
      navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <DlgRoot open={open && !!wallet?.address}>
      <DlgPortal>
        <DlgOverlay
          mode={mode}
          onClick={() => {
            onClose();
          }}
        />
        <DlgContentQR
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
              title={wallet?.address}
              style={{
                flexGrow: 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
                textAlign: 'center',
              }}
            >
              {copied ? 'Copied!' : wallet?.address}
            </DlgDescription>
          </div>
          <QRCode
            value={wallet?.address}
            logoImage={icon}
            logoPadding={5}
            size={256}
            qrStyle="dots"
            style={{ width: '256px', height: '256px' }}
          />
        </DlgContentQR>
      </DlgPortal>
    </DlgRoot>
  );
};
