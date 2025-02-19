import React, { useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import { CameraIcon, ExitIcon, IdCardIcon } from '@radix-ui/react-icons';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { motion } from 'framer-motion';

import { DlgOverlay, DlgPortal, DlgRoot, DlgTitle, DlgTrigger } from './modal';

export const ActionDrawer = ({
  mode = 'light',
  isConnected,
  scan,
  onLogout,
}: {
  mode?: 'dark' | 'light';
  isConnected: boolean;
  scan?: () => Promise<
    | undefined
    | {
        digest: string;
        effects: string;
      }
  >;
  onLogout: () => void;
}) => {
  const [open, setOpen] = useState<boolean>(false);

  const handleScan = () => {
    setOpen(false);
    !!scan && scan();
  };

  const handleLogout = () => {
    setOpen(false);
    onLogout();
  };

  return (
    <DlgRoot open={open} onOpenChange={setOpen}>
      {isConnected && (
        <DlgTrigger asChild>
          <div className="floating-bar">
            <div className="handle" />
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
            className="dialog-content"
          >
            <DlgTitle>
              <VisuallyHidden.Root>Action Drawer</VisuallyHidden.Root>
            </DlgTitle>
            <div className="action-buttons">
              {!!scan && (
                <button className="icon-button" onClick={handleScan}>
                  <CameraIcon className="icon" width={24} height={24} />
                </button>
              )}
              <button className="icon-button">
                <IdCardIcon className="icon" width={24} height={24} />
              </button>
              <button className="icon-button" onClick={handleLogout}>
                <ExitIcon className="icon" width={24} height={24} />
              </button>
            </div>
          </motion.div>
        </Dialog.Content>
      </DlgPortal>

      <style>
        {`
          .floating-bar {
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

          .handle {
            width: 40px;
            height: 5px;
            background: white;
            border-radius: 999px;
          }

          .dialog-content {
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
            gap: 24px;
            padding: 8px 16px;
            margin-top: 4px;
            background: #f7f7f7;
            border-radius: 12px;
          }

          .icon-button {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 12px;
            transition: background 0.2s ease-in-out;
          }

          .icon {
            color: #030f1c;
            transition: fill 0.2s ease-in-out;
          }

          .icon-button:hover {
            background: rgba(0, 0, 0, 0.1);
          }
        `}
      </style>
    </DlgRoot>
  );
};
