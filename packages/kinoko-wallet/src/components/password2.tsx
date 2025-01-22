import React, { useState } from 'react';

import { FormControl, FormField, FormInput, FormRoot } from './form';
import {
  DlgButton,
  DlgClose,
  DlgContent,
  DlgDescription,
  DlgOverlay,
  DlgPortal,
  DlgRoot,
  DlgTitle,
} from './modal';

export const Password2 = ({
  mode = 'light',
  onClose,
  onConfirm,
}: {
  mode?: 'dark' | 'light';
  onClose: () => void;
  onConfirm: (password: string) => void;
}) => {
  const [password, setPassword] = useState('');
  return (
    <DlgRoot open={true}>
      <DlgPortal>
        <DlgOverlay mode={mode} />
        <DlgContent mode={mode}>
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
                  onChange={(e) => {
                    setPassword(e.target.value);
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
            <DlgClose asChild>
              <DlgButton mode={mode} onClick={onClose}>
                Cancel
              </DlgButton>
            </DlgClose>
            <DlgButton
              mode={mode}
              disabled={password.length < 1}
              onClick={() => onConfirm(password)}
            >
              Confirm
            </DlgButton>
          </div>
        </DlgContent>
      </DlgPortal>
    </DlgRoot>
  );
};
