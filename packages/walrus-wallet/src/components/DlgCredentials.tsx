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
          style={{ height: '40vh' }}
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
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              marginTop: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                height: '150px',
                fontSize: '16px',
                color: '#888',
                gridColumn: '1 / -1',
              }}
            >
              developing...
            </div>
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
