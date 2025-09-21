import { useEffect, useState } from 'react';

import { SuiObjectData } from '@mysten/sui/client';
import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from '@zktx.io/walrus-connect';
import { Copy, Send, X } from 'lucide-react';

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
          className="nfts-content"
          aria-describedby={undefined}
        >
          <div className="nfts-header">
            <DlgTitle mode={mode}>NFTs</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <X />
            </DlgButtonIcon>
          </div>

          <div className="nfts-list" role="list" aria-busy={loading}>
            {loading && assets.length === 0 ? (
              <div className="nfts-empty">Loading...</div>
            ) : assets.length === 0 ? (
              <div className="nfts-empty">No Assets Available</div>
            ) : (
              assets.map((asset, index) => (
                <div
                  key={asset.objectId ?? `nft-${index}`}
                  className="nfts-card"
                  role="listitem"
                >
                  <div className="nfts-card-image">
                    {asset.display?.data?.image_url ? (
                      <img
                        src={asset.display.data.image_url}
                        alt={asset.display?.data?.name ?? `Asset ${index}`}
                        loading="lazy"
                      />
                    ) : (
                      <div className="nfts-no-image">No Image</div>
                    )}
                  </div>

                  <div className="nfts-card-body">
                    <div className="nfts-title">
                      {asset.display?.data?.name ?? 'No Name'}
                    </div>

                    <div className="nfts-row">
                      <div className="nfts-address">
                        {shortenAddress(asset.objectId)}
                      </div>
                      <button
                        className="nfts-copy"
                        aria-label="Copy object ID"
                        onClick={() =>
                          navigator.clipboard.writeText(asset.objectId)
                        }
                      >
                        <Copy size={14} />
                      </button>
                    </div>

                    <div className="nfts-desc">
                      {asset.display?.data?.description ?? 'No Description'}
                    </div>

                    <div className="nfts-actions">
                      <DlgButtonIcon
                        mode={mode}
                        disabled={loading}
                        onClick={() => openTransfer(asset)}
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
