import React from 'react';

import * as Dialog from '@radix-ui/react-dialog';

type Mode = 'light' | 'dark';

export const DlgRoot = Dialog.Root;
export const DlgTrigger = Dialog.Trigger;
export const DlgPortal = Dialog.Portal;

export const DlgOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Overlay> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Dialog.Overlay
    ref={ref}
    data-mode={mode}
    className={`dlg-overlay ${className}`.trim()}
    {...props}
  />
));
DlgOverlay.displayName = 'DlgOverlay';

export const DlgContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Dialog.Content
    ref={ref}
    data-mode={mode}
    className={`dlg-content ${className}`.trim()}
    aria-describedby={undefined}
    {...props}
  />
));
DlgContent.displayName = 'DlgContent';

export const DlgContentQR = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Dialog.Content
    ref={ref}
    data-mode={mode}
    className={`dlg-content-qr ${className}`.trim()}
    aria-describedby={undefined}
    {...props}
  />
));
DlgContentQR.displayName = 'DlgContentQR';

export const DlgContentBottom = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Dialog.Content
    ref={ref}
    data-mode={mode}
    className={`dlg-content-bottom ${className}`.trim()}
    aria-describedby={undefined}
    {...props}
  />
));
DlgContentBottom.displayName = 'DlgContentBottom';

export const DlgTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentProps<typeof Dialog.Title> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Dialog.Title
    ref={ref}
    data-mode={mode}
    className={`dlg-title ${className}`.trim()}
    {...props}
  />
));
DlgTitle.displayName = 'DlgTitle';

export const DlgDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof Dialog.Description> & {
    mode?: Mode;
    center?: boolean;
  }
>(({ className = '', mode = 'light', center, ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    data-mode={mode}
    className={`dlg-desc ${center ? 'dlg-desc-center' : ''} ${className}`.trim()}
    {...props}
  />
));
DlgDescription.displayName = 'DlgDescription';

export const DlgDescription2 = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof Dialog.Description> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    data-mode={mode}
    className={`dlg-desc dlg-desc-center ${className}`.trim()}
    {...props}
  />
));
DlgDescription2.displayName = 'DlgDescription2';

export const DlgButtonIcon = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <button
    ref={ref}
    data-mode={mode}
    className={`dlg-btn-icon ${className}`.trim()}
    {...props}
  />
));
DlgButtonIcon.displayName = 'DlgButtonIcon';

export const DlgButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <button
    ref={ref}
    data-mode={mode}
    className={`dlg-btn ${className}`.trim()}
    {...props}
  />
));
DlgButton.displayName = 'DlgButton';
