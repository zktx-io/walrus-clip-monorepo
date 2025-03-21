import React, { useEffect, useState } from 'react';

import { KioskOwnerCap } from '@mysten/kiosk';
import { SuiObjectData } from '@mysten/sui/client';
import { HiOutlineXMark } from 'react-icons/hi2';

import { FormCoinSelect, FormField, FormLabel, FormRoot } from './form';
import {
  DlgButton,
  DlgButtonIcon,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { useWalletState } from '../recoil';

export const DlgPlaceNFT = ({
  object,
  onClose,
  kioskPlace,
}: {
  object?: SuiObjectData;
  onClose: (isBack: boolean) => void;
  kioskPlace: (objData: {
    kiosk: KioskOwnerCap;
    object: SuiObjectData;
    recipient?: string;
  }) => Promise<void>;
}) => {
  const { mode, wallet } = useWalletState();
  const [kiosks, setKiosks] = useState<KioskOwnerCap[] | undefined>(undefined);
  const [selectedKiosk, setSelectedKiosk] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const update = async () => {
      if (object && wallet) {
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
  }, [object, wallet]);

  useEffect(() => {
    if (!!object) {
      setSelectedKiosk('');
      setLoading(false);
    }
  }, [object]);

  return (
    <DlgRoot open={!!object}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContent
          mode={mode}
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
            <DlgTitle mode={mode}>Place NFT</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <HiOutlineXMark />
            </DlgButtonIcon>
          </div>
          <DlgDescription mode={mode}>
            Places an item in the kiosk.
          </DlgDescription>

          <FormRoot>
            <FormField name="Select Kiosk">
              <FormLabel mode={mode}>Select Kiosk</FormLabel>
              <FormCoinSelect
                mode={mode}
                value={selectedKiosk}
                onChange={(e) => setSelectedKiosk(e.target.value)}
              >
                <option disabled value="">
                  Choose a kiosk
                </option>
                {kiosks &&
                  kiosks.map((kiosk, key) => (
                    <option key={key} value={`${key}`}>
                      {kiosk.kioskId}
                    </option>
                  ))}
              </FormCoinSelect>
            </FormField>
          </FormRoot>

          <div
            style={{
              display: 'flex',
              marginTop: 16,
              justifyContent: 'flex-end',
              gap: '12px',
            }}
          >
            <DlgButton
              mode={mode}
              disabled={!wallet || !selectedKiosk || loading}
              onClick={async () => {
                if (wallet && kiosks && object && selectedKiosk) {
                  try {
                    setLoading(true);
                    await kioskPlace({
                      kiosk: kiosks[parseInt(selectedKiosk)],
                      object: object,
                    });
                  } catch (e) {
                    //
                  } finally {
                    setLoading(false);
                  }
                }
              }}
            >
              Place
            </DlgButton>
          </div>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
