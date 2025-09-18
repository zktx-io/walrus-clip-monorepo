import React, { useEffect, useState } from 'react';

import { SuiObjectData } from '@mysten/sui/client';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { QRAddress, useWalrusScan } from '@zktx.io/walrus-connect';
import { motion } from 'framer-motion';
import { EllipsisVertical, Images, WalletMinimal } from 'lucide-react';

import { DlgBalances } from './DlgBalances';
import { DlgDashboard } from './DlgDashboard';
import { DlgNFTs } from './DlgNFTs';
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
  const [openNFTs, setOpenNFTs] = useState<boolean>(false);

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
                  <WalletMinimal className="action-icon" size={16} />
                </button>
                <button className="action-icon-button" onClick={handleNFTs}>
                  <Images className="action-icon" size={16} />
                </button>
                <button className="action-icon-button" onClick={handleSystem}>
                  <EllipsisVertical className="action-icon" size={16} />
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
        openAddress={() => {
          setOpen(false);
          setOpenSystem(false);
          setOpenAddress(true);
        }}
        openScan={() => {
          setOpen(false);
          setOpenSystem(false);
          isScannerEnabled && wallet && wallet.signer && scan(wallet.signer);
        }}
        onLogout={() => {
          setOpen(false);
          setOpenSystem(false);
          onLogout();
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
        }}
        onEvent={onEvent}
      />
    </>
  );
};
