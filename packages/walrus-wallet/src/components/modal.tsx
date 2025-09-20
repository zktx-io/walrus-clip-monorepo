import * as React from 'react';

import * as Dialog from '@radix-ui/react-dialog';

export type Mode = 'light' | 'dark';
type ModeProp = { mode?: Mode };

export const DlgRoot = Dialog.Root;
export const DlgTrigger = Dialog.Trigger;
export const DlgPortal = Dialog.Portal;

export const DlgOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Overlay> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Overlay
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-overlay ${className ?? ''}`.trim()}
  />
));
DlgOverlay.displayName = 'DlgOverlay';

export const DlgContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Content
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-content ${className ?? ''}`.trim()}
  />
));
DlgContent.displayName = 'DlgContent';

export const DlgContentQR = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Content
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-content-qr ${className ?? ''}`.trim()}
  />
));
DlgContentQR.displayName = 'DlgContentQR';

export const DlgContentBottom = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Dialog.Content> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Content
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-content-bottom ${className ?? ''}`.trim()}
  />
));
DlgContentBottom.displayName = 'DlgContentBottom';

export const DlgTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentProps<typeof Dialog.Title> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Title
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-title ${className ?? ''}`.trim()}
  />
));
DlgTitle.displayName = 'DlgTitle';

export const DlgDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof Dialog.Description> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Description
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-desc ${className ?? ''}`.trim()}
  />
));
DlgDescription.displayName = 'DlgDescription';

export const DlgDescription2 = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof Dialog.Description> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <Dialog.Description
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-desc dlg-desc-center ${className ?? ''}`.trim()}
  />
));
DlgDescription2.displayName = 'DlgDescription2';

export const DlgButtonIcon = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <button
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-btn-icon ${className ?? ''}`.trim()}
  />
));
DlgButtonIcon.displayName = 'DlgButtonIcon';

export const DlgButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <button
    {...props}
    ref={ref}
    data-mode={mode}
    className={`dlg-btn ${className ?? ''}`.trim()}
  />
));
DlgButton.displayName = 'DlgButton';
