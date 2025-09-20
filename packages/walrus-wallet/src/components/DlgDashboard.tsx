import {
  DlgButtonIcon,
  DlgContentBottom,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from '@zktx.io/walrus-connect';
import { LogOut, QrCode, ScanQrCode, X } from 'lucide-react';

import { useWalletState } from '../recoil';

export const DlgDashboard = ({
  open,
  onClose,
  onLogout,
  openAddress,
  openScan,
}: {
  open: boolean;
  onClose: (isBack: boolean) => void;
  onLogout: () => void;
  openAddress: () => void;
  openScan: () => void;
}) => {
  const { mode } = useWalletState();
  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay mode={mode} onClick={() => onClose(false)} />
        <DlgContentBottom
          mode={mode}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <div className="dashboard-header">
            <DlgTitle mode={mode}>Dashboard</DlgTitle>
            <DlgButtonIcon mode={mode} onClick={() => onClose(true)}>
              <X />
            </DlgButtonIcon>
          </div>

          <div className="dashboard-list">
            {[
              { label: 'Address', icon: QrCode, action: openAddress },
              { label: 'Scan', icon: ScanQrCode, action: openScan },
              { label: 'Logout', icon: LogOut, action: onLogout },
            ].map(({ label, icon: Icon, action }) => (
              <button key={label} className="dashboard-button" onClick={action}>
                <Icon size={24} className="dashboard-icon" />
                {label}
              </button>
            ))}
          </div>
        </DlgContentBottom>
      </DlgPortal>
    </DlgRoot>
  );
};
