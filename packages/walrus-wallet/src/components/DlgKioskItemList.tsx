import React, { useEffect, useState } from 'react';

import { KioskData, KioskOwnerCap } from '@mysten/kiosk';
import { SuiObjectData } from '@mysten/sui/client';
import { HiMiniClipboard, HiOutlineXMark } from 'react-icons/hi2';

import {
  DlgButton,
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';
import { shortenAddress } from '../utils/utils';

export const DlgKioskItemList = ({
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
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
              height: 'calc(100% - 10px)',
              overflowY: 'auto',
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
                }}
              >
                No Assets Available
              </div>
            ) : (
              kioskData?.items.map((asset, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    width: '100%',
                    height: '120px',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#f3f3f3',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      width: '120px',
                      height: '100%',
                      position: 'relative',
                    }}
                  >
                    {asset.display?.data?.image_url ? (
                      <img
                        src={asset.display.data.image_url}
                        alt={`Asset ${index}`}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          color: '#888',
                        }}
                      >
                        No Image
                      </div>
                    )}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 'bold',
                        fontSize: '14px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {asset.display?.data?.name ?? 'No Name'}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <div style={{ fontSize: '12px', color: '#555' }}>
                        {shortenAddress(asset.objectId)}
                      </div>
                      <HiMiniClipboard
                        style={{
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: '#888',
                        }}
                        onClick={() =>
                          navigator.clipboard.writeText(asset.objectId)
                        }
                        title="Copy address"
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#777',
                        marginTop: '4px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {asset.display?.data?.description ?? 'No Description'}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        marginTop: '4px',
                      }}
                    >
                      <DlgButton
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
                        Take
                      </DlgButton>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
