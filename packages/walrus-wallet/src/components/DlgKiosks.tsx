import React, { useEffect, useState } from 'react';

import { KioskOwnerCap } from '@mysten/kiosk';
import {
  HiOutlineUser,
  HiOutlineUserGroup,
  HiOutlineXMark,
} from 'react-icons/hi2';

import {
  DlgButton,
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  Mode,
} from './modal';
import { WalletStandard } from '../utils/walletStandard';

export const DlgKiosks = ({
  mode = 'light',
  wallet,
  open,
  onClose,
  onSelectKiosk,
}: {
  mode?: Mode;
  wallet?: WalletStandard;
  open: boolean;
  onClose: (isBack: boolean) => void;
  onSelectKiosk: (kioskId: KioskOwnerCap) => void;
}) => {
  const [kiosks, setKiosks] = useState<KioskOwnerCap[] | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  const handleCreateKiosk = async (isPersonal: boolean) => {
    if (wallet) {
      try {
        setLoading(true);
        await wallet.createKiosk(isPersonal);
        await new Promise((resolve) => setTimeout(resolve, 500));
        const kiosks = await wallet.getOwnedKiosks();
        if (kiosks && kiosks.length > 0) {
          setKiosks(kiosks);
        } else {
          setKiosks(undefined);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const update = async () => {
      if (open && wallet) {
        setLoading(true);
        const kiosks = await wallet.getOwnedKiosks();
        if (kiosks && kiosks.length > 0) {
          setKiosks(kiosks);
        } else {
          setKiosks(undefined);
        }
        setLoading(false);
      }
    };
    update();
  }, [open, wallet]);

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
            <DlgTitle mode={mode}>Kiosks</DlgTitle>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <DlgButtonIcon
                mode={mode}
                onClick={() => handleCreateKiosk(true)}
              >
                <HiOutlineUser size={24} />
              </DlgButtonIcon>
              <DlgButtonIcon
                mode={mode}
                onClick={() => handleCreateKiosk(false)}
              >
                <HiOutlineUserGroup size={24} />
              </DlgButtonIcon>
              <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
                <HiOutlineXMark size={24} />
              </DlgButtonIcon>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '100%',
              height: 'calc(100% - 10px)',
              overflowY: 'auto',
            }}
          >
            {loading && !kiosks ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  height: '150px',
                  fontSize: '16px',
                  color: '#888',
                }}
              >
                Loading...
              </div>
            ) : kiosks === undefined ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginTop: '20px',
                  width: '100%',
                }}
              >
                <p
                  style={{
                    fontSize: '16px',
                    color: '#888',
                    marginBottom: '10px',
                  }}
                >
                  No Kiosks Available
                </p>
                {wallet && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '10px',
                      marginTop: '10px',
                    }}
                  >
                    <DlgButton
                      mode={mode}
                      disabled={!wallet}
                      onClick={() => handleCreateKiosk(false)}
                    >
                      Create Shared Kiosk
                    </DlgButton>
                    <DlgButton
                      mode={mode}
                      disabled={!wallet}
                      onClick={() => handleCreateKiosk(true)}
                    >
                      Create Personal Kiosk
                    </DlgButton>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '10px',
                  width: '100%',
                  marginTop: '10px',
                  maxWidth: '450px',
                }}
              >
                {kiosks.map((item, index) => (
                  <div
                    key={index}
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
                      fontSize: 'clamp(14px, 1vw, 16px)',
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
                    onClick={() => onSelectKiosk(item)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        width: '100%',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.isPersonal ? (
                        <HiOutlineUser size="clamp(18px, 2vw, 20px)" />
                      ) : (
                        <HiOutlineUserGroup size="clamp(18px, 2vw, 20px)" />
                      )}
                      <span
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                        }}
                      >
                        {item.kioskId}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
