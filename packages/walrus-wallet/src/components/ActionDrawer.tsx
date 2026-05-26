import { useState } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import {
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
  DlgTrigger,
  QRAddress,
} from '../internal/walrusConnectRoute';
import { motion } from 'framer-motion';
import { LogOut, QrCode } from 'lucide-react';

import { useWalletState } from '../state/walletState';
import type { NotiVariant } from '../utils/walletTypes';

export const ActionDrawer = ({
  icon,
  isConnected,
  onEvent,
  onLogout,
}: {
  icon: string;
  isConnected: boolean;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
  onLogout?: () => void | Promise<void>;
}) => {
  const { mode, wallet } = useWalletState();
  const [open, setOpen] = useState(false);
  const [openAddress, setOpenAddress] = useState(false);

  const handleLogout = async () => {
    setOpen(false);
    try {
      if (onLogout) {
        await onLogout();
      } else {
        await wallet?.features['standard:disconnect'].disconnect();
      }
      onEvent({ variant: 'success', message: 'Logged out' });
    } catch (error) {
      onEvent({
        variant: 'error',
        message: `Logout failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  };

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
          <Dialog.Content
            asChild
            aria-describedby={undefined}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <motion.div
              initial={{ y: '100%', x: '-50%' }}
              animate={{ y: 0, x: '-50%' }}
              exit={{ y: '100%', x: '-50%' }}
              transition={{ type: 'spring', stiffness: 100 }}
              className="drawer-dialog-content"
              style={{ left: '50%' }}
              data-mode={mode}
            >
              <DlgTitle mode={mode}>
                <VisuallyHidden.Root>Action Drawer</VisuallyHidden.Root>
              </DlgTitle>
              <div className="drawer-buttons">
                <button
                  className="drawer-icon-button"
                  onClick={() => {
                    setOpen(false);
                    setOpenAddress(true);
                  }}
                  aria-label="Show wallet address"
                >
                  <QrCode className="drawer-icon" size={16} />
                </button>
                <button
                  className="drawer-icon-button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  aria-label="Logout"
                >
                  <LogOut className="drawer-icon" size={16} />
                </button>
              </div>
            </motion.div>
          </Dialog.Content>
        </DlgPortal>
      </DlgRoot>

      <QRAddress
        icon={icon}
        mode={mode}
        address={wallet?.accounts[0]?.address || ''}
        open={openAddress}
        onClose={() => setOpenAddress(false)}
      />
    </>
  );
};
