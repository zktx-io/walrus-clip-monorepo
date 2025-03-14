import React, { useState } from 'react';

import { FormControl, FormField, FormInput, FormRoot } from './form';
import {
  DlgButton,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';
import { NotiVariant } from '../utils/types';

export const PwCreate = ({
  mode = 'light',
  onClose,
  onConfirm,
  onEvent,
}: {
  mode: 'dark' | 'light';
  onClose: () => void;
  onConfirm: (password: string) => void;
  onEvent: (data: { variant: NotiVariant; message: string }) => void;
}) => {
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  return (
    <DlgRoot open={open}>
      <DlgPortal>
        <DlgOverlay
          mode={mode}
          onClick={() => {
            onEvent({
              variant: 'error',
              message: 'Password confirmation cancelled',
            });
            setOpen(false);
            onClose();
          }}
          style={{ zIndex: 2147483645 }}
        />
        <DlgContent
          mode={mode}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
          }}
          style={{ zIndex: 2147483645 }}
        >
          <DlgTitle mode={mode}>Confirm password</DlgTitle>
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                  }}
                />
              </FormControl>
            </FormField>
          </FormRoot>
          <FormRoot>
            <FormField name="confirmPassword">
              <FormControl asChild>
                <FormInput
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  mode={mode}
                  placeholder="confirm password"
                  type="password"
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                  }}
                />
              </FormControl>
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
              disabled={password !== confirmPassword || password.length < 1}
              onClick={() => {
                setOpen(false);
                onConfirm(password);
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
