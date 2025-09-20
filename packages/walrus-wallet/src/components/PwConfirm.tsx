import React, { useEffect, useState } from 'react';

import {
  FormControl,
  FormField,
  FormInput,
  FormMessage,
  FormRoot,
} from './form';
import {
  DlgButton,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';

export const PwConfirm = ({
  mode = 'light',
  onClose,
  onConfirm,
}: {
  mode: 'light' | 'dark';
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
}) => {
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setLoading(false);
      setError(false);
    }
  }, [open]);

  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay
          mode={mode}
          onClick={() => {
            setOpen(false);
            onClose();
          }}
        />
        <DlgContent
          mode={mode}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <DlgTitle mode={mode}>Sign</DlgTitle>
          <DlgDescription mode={mode}>
            Please confirm your password to proceed.
          </DlgDescription>

          <FormRoot>
            <FormField name="password">
              <FormControl asChild>
                <FormInput
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  mode={mode}
                  placeholder="password"
                  type="password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </FormControl>
              {error && (
                <FormMessage mode={mode} error>
                  incorrect password
                </FormMessage>
              )}
            </FormField>
          </FormRoot>

          <div className="dlg-actions-right">
            <DlgButton
              mode={mode}
              disabled={password.length < 1 || loading}
              onClick={async () => {
                try {
                  setLoading(true);
                  setError(false);
                  await onConfirm(password);
                  setOpen(false);
                } catch {
                  setError(true);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Confirm
            </DlgButton>
          </div>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
