import React from 'react';

import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineBuildingStorefront,
  HiOutlineIdentification,
  HiOutlineXMark,
} from 'react-icons/hi2';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  Mode,
} from './modal';

export const DlgSystem = ({
  mode = 'light',
  open,
  onClose,
  onLogout,
  openCredentials,
  openKiosk,
}: {
  mode?: Mode;
  open: boolean;
  onClose: (isBack: boolean) => void;
  onLogout: () => void;
  openCredentials: () => void;
  openKiosk: () => void;
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
            <DlgTitle mode={mode}>Account</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
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
                label: 'Credentials',
                icon: HiOutlineIdentification,
                action: openCredentials,
              },
              {
                label: 'Kiosks',
                icon: HiOutlineBuildingStorefront,
                action: openKiosk,
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

            <button
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
                e.currentTarget.style.background = 'rgba(220, 53, 69, 1)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'black';
              }}
              onClick={onLogout}
            >
              <HiOutlineArrowRightOnRectangle
                size={24}
                style={{ marginRight: '10px' }}
              />
              Logout
            </button>
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
