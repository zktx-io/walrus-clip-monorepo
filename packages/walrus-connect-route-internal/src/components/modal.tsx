import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  Ref,
} from 'react';

import * as Dialog from '@radix-ui/react-dialog';

type Mode = 'light' | 'dark';

export const DlgRoot = Dialog.Root;
export const DlgTrigger = Dialog.Trigger;
export const DlgPortal = Dialog.Portal;

type DlgOverlayProps = ComponentPropsWithoutRef<typeof Dialog.Overlay> & {
  mode?: Mode;
  ref?: Ref<HTMLDivElement>;
};

export function DlgOverlay({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgOverlayProps) {
  return (
    <Dialog.Overlay
      ref={ref}
      data-mode={mode}
      className={`dlg-overlay ${className}`.trim()}
      {...props}
    />
  );
}

type DlgContentProps = ComponentPropsWithoutRef<typeof Dialog.Content> & {
  mode?: Mode;
  ref?: Ref<HTMLDivElement>;
};

export function DlgContent({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgContentProps) {
  return (
    <Dialog.Content
      ref={ref}
      data-mode={mode}
      className={`dlg-content ${className}`.trim()}
      aria-describedby={undefined}
      {...props}
    />
  );
}

export function DlgContentQR({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgContentProps) {
  return (
    <Dialog.Content
      ref={ref}
      data-mode={mode}
      className={`dlg-content-qr ${className}`.trim()}
      aria-describedby={undefined}
      {...props}
    />
  );
}

export function DlgContentBottom({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgContentProps) {
  return (
    <Dialog.Content
      ref={ref}
      data-mode={mode}
      className={`dlg-content-bottom ${className}`.trim()}
      aria-describedby={undefined}
      {...props}
    />
  );
}

type DlgTitleProps = ComponentPropsWithoutRef<typeof Dialog.Title> & {
  mode?: Mode;
  ref?: Ref<HTMLHeadingElement>;
};

export function DlgTitle({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgTitleProps) {
  return (
    <Dialog.Title
      ref={ref}
      data-mode={mode}
      className={`dlg-title ${className}`.trim()}
      {...props}
    />
  );
}

type DlgDescriptionProps = ComponentPropsWithoutRef<
  typeof Dialog.Description
> & {
  mode?: Mode;
  center?: boolean;
  ref?: Ref<HTMLParagraphElement>;
};

export function DlgDescription({
  className = '',
  mode = 'light',
  center,
  ref,
  ...props
}: DlgDescriptionProps) {
  return (
    <Dialog.Description
      ref={ref}
      data-mode={mode}
      className={`dlg-desc ${center ? 'dlg-desc-center' : ''} ${className}`.trim()}
      {...props}
    />
  );
}

type DlgDescription2Props = ComponentPropsWithoutRef<
  typeof Dialog.Description
> & {
  mode?: Mode;
  ref?: Ref<HTMLParagraphElement>;
};

export function DlgDescription2({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgDescription2Props) {
  return (
    <Dialog.Description
      ref={ref}
      data-mode={mode}
      className={`dlg-desc dlg-desc-center ${className}`.trim()}
      {...props}
    />
  );
}

type DlgButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  mode?: Mode;
  ref?: Ref<HTMLButtonElement>;
};

export function DlgButtonIcon({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgButtonProps) {
  return (
    <button
      ref={ref}
      data-mode={mode}
      className={`dlg-btn-icon ${className}`.trim()}
      {...props}
    />
  );
}

export function DlgButton({
  className = '',
  mode = 'light',
  ref,
  ...props
}: DlgButtonProps) {
  return (
    <button
      ref={ref}
      data-mode={mode}
      className={`dlg-btn ${className}`.trim()}
      {...props}
    />
  );
}
