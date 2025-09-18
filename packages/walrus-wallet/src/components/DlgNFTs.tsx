import React, { useEffect, useState } from 'react';

import { SuiObjectData } from '@mysten/sui/client';
import { Copy, Send, X } from 'lucide-react';

import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';
import { shortenAddress } from '../utils/utils';

export const DlgNFTs = ({
  open,
  onClose,
  openTransfer,
}: {
  open: boolean;
  onClose: (isBack: boolean) => void;
  openTransfer: (objData: SuiObjectData) => void;
}) => {
  const { mode, wallet } = useWalletState();
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
            <DlgTitle mode={mode}>NFTs</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <X />
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
            {loading && assets.length === 0 ? (
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
              assets.map((asset, index) => (
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
                      <Copy
                        style={{
                          cursor: 'pointer',
                          color: '#888',
                        }}
                        size={14}
                        onClick={() =>
                          navigator.clipboard.writeText(asset.objectId)
                        }
                      />
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#777',
                        marginTop: '4px',
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
                        gap: '6px',
                      }}
                    >
                      <DlgButtonIcon
                        mode={mode}
                        disabled={loading}
                        onClick={() => {
                          openTransfer(asset);
                        }}
                      >
                        <Send />
                      </DlgButtonIcon>
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
