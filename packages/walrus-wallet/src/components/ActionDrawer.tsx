import React, { useEffect, useState } from 'react';

import { KioskOwnerCap } from '@mysten/kiosk';
import { SuiObjectData } from '@mysten/sui/client';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { QRAddress, useWalrusScan } from '@zktx.io/walrus-scan';
import { motion } from 'framer-motion';
import {
  HiOutlineCamera,
  HiOutlinePhoto,
  HiOutlineQrCode,
  HiOutlineSquares2X2,
  HiOutlineWallet,
} from 'react-icons/hi2';

import { DlgBalances } from './DlgBalances';
import { DlgCredentials } from './DlgCredentials';
import { DlgDashboard } from './DlgDashboard';
import { DlgKioskItemList } from './DlgKioskItemList';
import { DlgKiosks } from './DlgKiosks';
import { DlgNFTs } from './DlgNFTs';
import { DlgPlaceNFT } from './DlgPlaceNFT';
import { DlgTransferCoin } from './DlgTransferCoin';
import { DlgTransferNFT } from './DlgTransferNFT';
import { DlgOverlay, DlgPortal, DlgRoot, DlgTitle, DlgTrigger } from './modal';
import { useWalletState } from '../recoil';
import { NotiVariant } from '../utils/types';
import { FloatCoinBalance } from '../utils/walletStandard';

export const ActionDrawer = ({
  icon,
  isConnected,
  onLogout,
  onEvent,
}: {
  icon: string;
  isConnected: boolean;
  onLogout: () => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const [isScannerEnabled, setIsScannerEnabled] = useState<boolean>(false);

  const { scan } = useWalrusScan();
  const { mode, wallet } = useWalletState();
  const [open, setOpen] = useState<boolean>(false);
  const [openAddress, setOpenAddress] = useState<boolean>(false);
  const [openBalances, setOpenBalances] = useState<boolean>(false);
  const [openSystem, setOpenSystem] = useState<boolean>(false);

  const [openTransferCoin, setOpenTransferCoin] = useState<
    { address?: string; coin?: FloatCoinBalance } | undefined
  >(undefined);
  const [openTransferNFT, setOpenTransferNFT] = useState<
    SuiObjectData | undefined
  >(undefined);
  const [openCredentials, setOpenCredentials] = useState<boolean>(false);
  const [openNFTs, setOpenNFTs] = useState<boolean>(false);
  const [openKiosk, setOpenKiosk] = useState<boolean>(false);
  const [openKioskPlace, setOpenKioskPlace] = useState<
    SuiObjectData | undefined
  >(undefined);
  const [openKioskTake, setOpenKioskTake] = useState<KioskOwnerCap | undefined>(
    undefined,
  );

  const handleScan = () => {
    if (wallet && wallet.signer) {
      setOpen(false);
      scan(wallet.signer);
    }
  };

  const handleAddress = () => {
    setOpen(false);
    setOpenAddress(true);
  };

  const handleBalances = () => {
    setOpen(false);
    setOpenBalances(true);
  };

  const handleNFTs = () => {
    setOpen(false);
    setOpenNFTs(true);
  };

  const handleSystem = () => {
    setOpen(false);
    setOpenSystem(true);
  };

  useEffect(() => {
    const testCamera = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(
          (device) => device.kind === 'videoinput',
        );
        if (videoInputDevices.length > 0) {
          setIsScannerEnabled(true);
        } else {
          setIsScannerEnabled(false);
        }
      } catch (error) {
        setIsScannerEnabled(false);
      }
    };
    testCamera();
  }, []);

  return (
    <>
      <DlgRoot open={open} onOpenChange={setOpen}>
        {isConnected && (
          <DlgTrigger asChild>
            <div className="action-floating-bar">
              <div className="action-handle" />
            </div>
          </DlgTrigger>
        )}

        <DlgPortal>
          <DlgOverlay mode={mode} />
          <Dialog.Content
            asChild
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => event.preventDefault()}
          >
            <motion.div
              initial={{ y: '100%', x: '-50%' }}
              animate={{ y: 0, x: '-50%' }}
              exit={{ y: '100%', x: '-50%' }}
              transition={{ type: 'spring', stiffness: 100 }}
              className="action-dialog-content"
            >
              <DlgTitle>
                <VisuallyHidden.Root>Action Drawer</VisuallyHidden.Root>
              </DlgTitle>
              <div className="action-buttons">
                <button className="action-icon-button" onClick={handleBalances}>
                  <HiOutlineWallet
                    className="action-icon"
                    width={32}
                    height={32}
                  />
                </button>
                <button className="action-icon-button" onClick={handleNFTs}>
                  <HiOutlinePhoto
                    className="action-icon"
                    width={32}
                    height={32}
                  />
                </button>
                <button className="action-icon-button" onClick={handleAddress}>
                  <HiOutlineQrCode
                    className="action-icon"
                    width={32}
                    height={32}
                  />
                </button>
                {isScannerEnabled && wallet && wallet.signer && (
                  <button className="action-icon-button" onClick={handleScan}>
                    <HiOutlineCamera
                      className="action-icon"
                      width={32}
                      height={32}
                    />
                  </button>
                )}
                <button className="action-icon-button" onClick={handleSystem}>
                  <HiOutlineSquares2X2
                    className="action-icon"
                    width={32}
                    height={32}
                  />
                </button>
              </div>
            </motion.div>
          </Dialog.Content>
        </DlgPortal>

        <style>
          {`
          .action-floating-bar {
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 150px;
            height: 25px;
            background: rgba(0, 0, 0, 0.6);
            border-radius: 10px 20px 0 0;
            display: flex;
            justify-content: center;
            align-items: center;
            cursor: pointer;
          }

          .action-handle {
            width: 40px;
            height: 5px;
            background: white;
            border-radius: 999px;
          }

          .action-dialog-content {
            position: fixed;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            max-width: 500px;
            background: white;
            border-radius: 12px 12px 0 0;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            z-index: 1234;
          }

          .action-buttons {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 16px;
            padding: 8px 16px;
            margin-top: 4px;
            background: #f7f7f7;
            border-radius: 12px;
          }

          .action-icon-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 12px;
            transition: background 0.2s ease-in-out;
          }

          .action-icon {
            color: #030f1c;
            transition: fill 0.2s ease-in-out;
          }

          .action-icon-button:hover {
            background: rgba(0, 0, 0, 0.1);
          }
        `}
        </style>
      </DlgRoot>
      <QRAddress
        icon={icon}
        mode={mode}
        address={wallet?.address || ''}
        open={openAddress}
        onClose={() => {
          setOpenAddress(false);
        }}
      />
      <DlgDashboard
        open={openSystem}
        onClose={(isBack: boolean) => {
          isBack && setOpen(true);
          setOpenSystem(false);
        }}
        onLogout={() => {
          setOpen(false);
          setOpenSystem(false);
          onLogout();
        }}
        openCredentials={() => {
          setOpenSystem(false);
          setOpenCredentials(true);
        }}
        openKiosk={() => {
          setOpenSystem(false);
          setOpenKiosk(true);
        }}
      />

      <DlgBalances
        open={openBalances}
        onClose={(isBack: boolean) => {
          isBack && setOpen(true);
          setOpenBalances(false);
        }}
        openTransfer={(option) => {
          setOpenBalances(false);
          setOpenTransferCoin(option);
        }}
      />
      <DlgNFTs
        open={openNFTs}
        onClose={(isBack: boolean) => {
          isBack && setOpen(true);
          setOpenNFTs(false);
        }}
        openTransfer={(objData) => {
          setOpenNFTs(false);
          setOpenTransferNFT(objData);
        }}
        openKioskPlace={(objData) => {
          setOpenNFTs(false);
          setOpenKioskPlace(objData);
        }}
      />

      <DlgTransferCoin
        open={openTransferCoin}
        onClose={(isBack: boolean) => {
          isBack && setOpenBalances(true);
          setOpen(false);
          setOpenTransferCoin(undefined);
        }}
        onEvent={onEvent}
      />
      <DlgTransferNFT
        object={openTransferNFT}
        onClose={(isBack: boolean) => {
          isBack && setOpenNFTs(true);
          setOpen(false);
          setOpenTransferNFT(undefined);
          setOpenKioskPlace(undefined);
        }}
        onEvent={onEvent}
      />
      <DlgPlaceNFT
        object={openKioskPlace}
        onClose={(isBack: boolean) => {
          isBack && setOpenNFTs(true);
          setOpen(false);
          setOpenTransferNFT(undefined);
          setOpenKioskPlace(undefined);
        }}
        kioskPlace={async (objData) => {
          if (wallet) {
            await wallet.kioskPlace(objData.kiosk, {
              item: objData.object.objectId,
              itemType: objData.object.type!,
            });
            setOpen(false);
            setOpenKioskPlace(undefined);
            onEvent({
              variant: 'success',
              message: 'Item placed in kiosk',
            });
          }
        }}
      />

      <DlgKioskItemList
        open={openKioskTake}
        onClose={(isBack: boolean) => {
          isBack && setOpenKiosk(true);
          setOpenKioskTake(undefined);
        }}
        kioskTake={async (objData) => {
          if (wallet) {
            await wallet.kiosTake(
              objData.kiosk,
              {
                itemId: objData.object.objectId,
                itemType: objData.object.type!,
              },
              objData.recipient,
            );
            setOpenKioskTake(undefined);
            setOpen(false);
            onEvent({
              variant: 'success',
              message: 'Item taken from kiosk',
            });
          }
        }}
      />

      <DlgCredentials
        open={openCredentials}
        onClose={(isBack: boolean) => {
          isBack && setOpenSystem(true);
          setOpenCredentials(false);
        }}
      />
      <DlgKiosks
        open={openKiosk}
        onClose={(isBack: boolean) => {
          isBack && setOpenSystem(true);
          setOpenKiosk(false);
        }}
        onSelectKiosk={(kiosk) => {
          setOpenKiosk(false);
          setOpenKioskTake(kiosk);
        }}
      />
    </>
  );
};
