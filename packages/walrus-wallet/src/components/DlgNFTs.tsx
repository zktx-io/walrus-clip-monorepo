import React, { useEffect, useState } from 'react';

import { SuiObjectData } from '@mysten/sui/client';
import {
  HiOutlineBuildingStorefront,
  HiOutlinePaperAirplane,
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
import { WalletStandard } from '../utils/walletStandard';

export const DlgNFTs = ({
  mode = 'light',
  wallet,
  open,
  onClose,
  openTransfer,
  openKioskTransfer,
}: {
  mode?: Mode;
  wallet?: WalletStandard;
  open: boolean;
  onClose: (isBack: boolean) => void;
  openTransfer: (nftId: string) => void;
  openKioskTransfer: (nftId: string) => void;
}) => {
  const [assets, setAssets] = useState<SuiObjectData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const update = async () => {
      if (open && wallet) {
        setLoading(true);
        const allAssets = await wallet.getOwnedObjects();
        setAssets(allAssets || []);
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
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
            }}
          >
            <DlgTitle mode={mode}>NFTs</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
            </DlgButtonIcon>
          </div>

          {loading ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                maxHeight: '50vh',
                overflowY: 'auto',
                marginTop: '10px',
                justifyContent: 'center',
              }}
            >
              {[...Array(1)].map((_, index) => (
                <div
                  key={index}
                  style={{
                    width: '100%',
                    paddingBottom: '100%',
                    position: 'relative',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#e0e0e0',
                    animation: 'pulse 1.5s infinite ease-in-out',
                  }}
                />
              ))}
              <style>
                {`
                  @keyframes pulse {
                    0% { opacity: 0.6; }
                    50% { opacity: 1; }
                    100% { opacity: 0.6; }
                  }
                `}
              </style>
            </div>
          ) : assets.length === 0 ? (
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                alignItems: 'center',
                gap: '10px',
                width: '100%',
                maxHeight: '50vh',
                overflowY: 'auto',
                marginTop: '10px',
                justifyContent: 'center',
              }}
            >
              {assets.map((asset, index) => (
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
                      onClick={() => {
                        openTransfer(asset.objectId);
                      }}
                    >
                      <HiOutlinePaperAirplane />
                    </DlgButtonIcon>
                    <DlgButtonIcon
                      mode={mode}
                      onClick={() => {
                        openKioskTransfer(asset.objectId);
                      }}
                    >
                      <HiOutlineBuildingStorefront />
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
              ))}
            </div>
          )}
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
