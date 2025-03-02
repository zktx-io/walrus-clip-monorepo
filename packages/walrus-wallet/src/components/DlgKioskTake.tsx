import React, { useEffect, useState } from 'react';

import { KioskData, KioskOwnerCap } from '@mysten/kiosk';
import { SuiObjectData } from '@mysten/sui/client';
import { HiOutlineArrowUpOnSquareStack, HiOutlineXMark } from 'react-icons/hi2';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';

export const DlgKioskTake = ({
  open,
  onClose,
  kioskTake,
}: {
  open: KioskOwnerCap | undefined;
  onClose: (isBack: boolean) => void;
  kioskTake: (objData: {
    kiosk: KioskOwnerCap;
    object: SuiObjectData;
    recipient?: string;
  }) => Promise<void>;
}) => {
  const { mode, wallet } = useWalletState();
  const [kioskData, setKioskData] = useState<
    { kiosk: KioskData; items: SuiObjectData[] } | undefined
  >(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const update = async () => {
      if (open && wallet) {
        setLoading(true);
        const data = await wallet.getKiosk(open.kioskId);
        setKioskData(data);
        setLoading(false);
      }
    };
    update();
  }, [open, wallet]);

  useEffect(() => {
    if (open) {
      setLoading(false);
      setKioskData(undefined);
    }
  }, [open]);

  return (
    <DlgRoot open={!!open}>
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
            <DlgTitle mode={mode}>Kiosk Item List</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
            </DlgButtonIcon>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              width: '100%',
              height: 'calc(100% - 10px)',
              overflowY: 'auto',
              alignItems: 'start',
              gridAutoFlow: 'row',
            }}
          >
            {loading && !kioskData ? (
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
                Loading...
              </div>
            ) : kioskData?.items.length === 0 ? (
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
                No Assets Available
              </div>
            ) : (
              kioskData?.items.map((asset, index) => (
                <div
                  key={index}
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '100%',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#f3f3f3',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      display: 'flex',
                      gap: '2px',
                      zIndex: 10,
                    }}
                  >
                    <DlgButtonIcon
                      mode={mode}
                      disabled={loading}
                      onClick={async () => {
                        try {
                          if (open) {
                            setLoading(true);
                            await kioskTake({ kiosk: open, object: asset });
                          }
                        } catch (error) {
                          //
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      <HiOutlineArrowUpOnSquareStack />
                    </DlgButtonIcon>
                  </div>

                  {asset.display?.data?.image_url ? (
                    <img
                      src={asset.display.data.image_url}
                      alt={`Asset ${index}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        color: '#888',
                      }}
                    >
                      No Image
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
