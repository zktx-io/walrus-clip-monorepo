import React, { useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { motion } from 'framer-motion';
import {
  HiOutlineArrowRightOnRectangle,
  HiOutlineCamera,
  HiOutlineIdentification,
  HiOutlineQrCode,
  HiOutlineWallet,
} from 'react-icons/hi2';

import { DlgBalance } from './DlgBalance';
import {
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  DlgTrigger,
  Mode,
} from './modal';
import { QRAddress } from './QRAddress';
import { NotiVariant } from '../utils/types';
import { WalletStandard } from '../utils/walletStandard';

export const ActionDrawer = ({
  mode = 'light',
  icon,
  wallet,
  isConnected,
  scan,
  onLogout,
  onEvent,
}: {
  icon: string;
  mode?: Mode;
  wallet?: WalletStandard;
  isConnected: boolean;
  scan?: () => Promise<
    | undefined
    | {
        digest: string;
        effects: string;
      }[]
  >;
  onLogout: () => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [openAccount, setOpenAccount] = useState<boolean>(false);
  const [openAddress, setOpenAddress] = useState<boolean>(false);

  const handleScan = () => {
    setOpen(false);
    !!scan && scan();
  };

  const handleAccount = () => {
    setOpen(false);
    setOpenAccount(true);
  };

  const handleAddress = () => {
    setOpen(false);
    setOpenAddress(true);
  };

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

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
          <DlgOverlay />
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
                <button className="action-icon-button" onClick={handleAccount}>
                  <HiOutlineWallet
                    className="action-icon"
                    width={32}
                    height={32}
                  />
                </button>
                <button className="action-icon-button">
                  <HiOutlineIdentification
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
                {!!scan && (
                  <button className="action-icon-button" onClick={handleScan}>
                    <HiOutlineCamera
                      className="action-icon"
                      width={32}
                      height={32}
                    />
                  </button>
                )}
                <button className="action-icon-button" onClick={handleLogout}>
                  <HiOutlineArrowRightOnRectangle
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
            z-index: 2147483647;
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
      <DlgBalance
        mode={mode}
        wallet={wallet}
        open={openAccount}
        onClose={() => setOpenAccount(false)}
        onEvent={onEvent}
      />
      <QRAddress
        mode={mode}
        icon={icon}
        address={wallet?.address}
        open={openAddress}
        onClose={() => setOpenAddress(false)}
      />
    </>
  );
};
