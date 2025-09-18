import React from 'react';

import { LogOut, QrCode, ScanQrCode, X } from 'lucide-react';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';

export const DlgDashboard = ({
  open,
  onClose,
  onLogout,
  openAddress,
  openScan,
}: {
  open: boolean;
  onClose: (isBack: boolean) => void;
  onLogout: () => void;
  openAddress: () => void;
  openScan: () => void;
}) => {
  const { mode } = useWalletState();
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
            <DlgTitle mode={mode}>Dashboard</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <X />
            </DlgButtonIcon>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              width: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: '10px',
            }}
          >
            {[
              {
                label: 'Address',
                icon: QrCode,
                action: openAddress,
              },
              {
                label: 'Scan',
                icon: ScanQrCode,
                action: openScan,
              },
              {
                label: 'Logout',
                icon: LogOut,
                action: onLogout,
              },
            ].map(({ label, icon: Icon, action }) => (
              <button
                key={label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  width: '100%',
                  padding: '10px',
                  borderRadius: '8px',
                  background: 'transparent',
                  color: 'black',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  transition: 'background 0.3s, color 0.3s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.color = 'black';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'black';
                }}
                onClick={action}
              >
                <Icon size={24} style={{ marginRight: '10px' }} />
                {label}
              </button>
            ))}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
