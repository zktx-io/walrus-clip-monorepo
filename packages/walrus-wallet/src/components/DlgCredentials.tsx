import React from 'react';

import { HiOutlineXMark } from 'react-icons/hi2';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  Mode,
} from './modal';
import { WalletStandard } from '../utils/walletStandard';

export const DlgCredentials = ({
  mode = 'light',
  wallet,
  open,
  onClose,
}: {
  mode?: Mode;
  wallet?: WalletStandard;
  open: boolean;
  onClose: (isBack: boolean) => void;
}) => {
  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContentBottom
          mode={mode}
          aria-describedby={undefined}
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
            <DlgTitle mode={mode}>Credentials</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
            </DlgButtonIcon>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginTop: '10px',
              width: '100%',
            }}
          >
            {'developing...'}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
