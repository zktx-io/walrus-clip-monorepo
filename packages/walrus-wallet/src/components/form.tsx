import * as React from 'react';

import * as Form from '@radix-ui/react-form';

type Mode = 'light' | 'dark';
type ModeProp = { mode?: Mode };

export const FormRoot = Form.Root;
export const FormControl = Form.Control;

export const FormField: React.FC<React.ComponentProps<typeof Form.Field>> = ({
  className,
  ...props
}) => (
  <Form.Field {...props} className={`form-field ${className ?? ''}`.trim()} />
);

export const FormLabel: React.FC<
  React.ComponentProps<typeof Form.Label> & ModeProp
> = ({ className, mode = 'light', ...props }) => (
  <Form.Label
    {...props}
    data-mode={mode}
    className={`form-label ${className ?? ''}`.trim()}
  />
);

export const FormMessage: React.FC<
  React.ComponentProps<typeof Form.Message> & ModeProp & { error?: boolean }
> = ({ className, mode = 'light', error = false, ...props }) => (
  <Form.Message
    {...props}
    data-mode={mode}
    data-error={String(error)}
    className={`form-message ${className ?? ''}`.trim()}
  />
);

export const FormInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <input
    {...props}
    ref={ref}
    data-mode={mode}
    className={`form-input ${className ?? ''}`.trim()}
  />
));
FormInput.displayName = 'FormInput';

export const FormCoinSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <select
    {...props}
    ref={ref}
    data-mode={mode}
    className={`form-select ${className ?? ''}`.trim()}
  />
));
FormCoinSelect.displayName = 'FormCoinSelect';

export const FormInputWithButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <div
    {...props}
    ref={ref}
    data-mode={mode}
    className={`form-input-wrap ${className ?? ''}`.trim()}
  />
));
FormInputWithButton.displayName = 'FormInputWithButton';

export const FormInputButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & ModeProp
>(({ className, mode = 'light', ...props }, ref) => (
  <button
    {...props}
    ref={ref}
    data-mode={mode}
    className={`form-input-btn ${className ?? ''}`.trim()}
  />
));
FormInputButton.displayName = 'FormInputButton';
