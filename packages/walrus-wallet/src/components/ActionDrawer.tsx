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
  const [isScannerEnabled, setIsScannerEnabled] = useState(false);
  const { scan } = useWalrusScan();
  const { mode, wallet } = useWalletState();
  const [open, setOpen] = useState(false);
  const [openAddress, setOpenAddress] = useState(false);
  const [openBalances, setOpenBalances] = useState(false);
  const [openSystem, setOpenSystem] = useState(false);
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
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        setIsScannerEnabled(hasVideo);
      } catch {
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
            <div className="drawer-floating-bar">
              <div className="drawer-handle" />
            </div>
          </DlgTrigger>
        )}

        <DlgPortal>
          <DlgOverlay mode={mode} />
          <Dialog.Content asChild onOpenAutoFocus={(e) => e.preventDefault()}>
            <motion.div
              initial={{ y: '100%', x: '-50%' }}
              animate={{ y: 0, x: '-50%' }}
              exit={{ y: '100%', x: '-50%' }}
              transition={{ type: 'spring', stiffness: 100 }}
              className="drawer-dialog-content"
              style={{ left: '50%' }}
              data-mode={mode}
            >
              <DlgTitle>
                <VisuallyHidden.Root>Action Drawer</VisuallyHidden.Root>
              </DlgTitle>
              <div className="drawer-buttons">
                <button className="drawer-icon-button" onClick={handleBalances}>
                  <WalletMinimal className="drawer-icon" size={16} />
                </button>
                <button className="drawer-icon-button" onClick={handleNFTs}>
                  <Images className="drawer-icon" size={16} />
                </button>
                <button className="drawer-icon-button" onClick={handleSystem}>
                  <EllipsisVertical className="drawer-icon" size={16} />
                </button>
              </div>
            </motion.div>
          </Dialog.Content>
        </DlgPortal>
      </DlgRoot>

      <QRAddress
        icon={icon}
        mode={mode}
        address={wallet?.address || ''}
        open={openAddress}
        onClose={() => setOpenAddress(false)}
      />
      <DlgDashboard
        open={openSystem}
        onClose={(isBack) => {
          if (isBack) setOpen(true);
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
          isScannerEnabled && wallet?.signer && scan(wallet.signer);
        }}
        onLogout={() => {
          setOpen(false);
          setOpenSystem(false);
          onLogout();
        }}
      />
      <DlgBalances
        open={openBalances}
        onClose={(isBack) => {
          if (isBack) setOpen(true);
          setOpenBalances(false);
        }}
        openTransfer={(option) => {
          setOpenBalances(false);
          setOpenTransferCoin(option);
        }}
      />
      <DlgNFTs
        open={openNFTs}
        onClose={(isBack) => {
          if (isBack) setOpen(true);
          setOpenNFTs(false);
        }}
        openTransfer={(objData) => {
          setOpenNFTs(false);
          setOpenTransferNFT(objData);
        }}
      />
      <DlgTransferCoin
        open={openTransferCoin}
        onClose={(isBack) => {
          if (isBack) setOpenBalances(true);
          setOpen(false);
          setOpenTransferCoin(undefined);
        }}
        onEvent={onEvent}
      />
      <DlgTransferNFT
        object={openTransferNFT}
        onClose={(isBack) => {
          if (isBack) setOpenNFTs(true);
          setOpen(false);
          setOpenTransferNFT(undefined);
        }}
        onEvent={onEvent}
      />
    </>
  );
};
