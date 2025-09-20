import React from 'react';

import * as Form from '@radix-ui/react-form';

type Mode = 'light' | 'dark';

export const FormRoot = Form.Root;
export const FormControl = Form.Control;

export const FormField = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof Form.Field>
>(({ className = '', ...props }, ref) => (
  <Form.Field
    ref={ref}
    className={`form-field ${className}`.trim()}
    {...props}
  />
));
FormField.displayName = 'FormField';

export const FormLabel = React.forwardRef<
  HTMLLabelElement,
  React.ComponentProps<typeof Form.Label> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <Form.Label
    ref={ref}
    data-mode={mode}
    className={`form-label ${className}`.trim()}
    {...props}
  />
));
FormLabel.displayName = 'FormLabel';

export const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentProps<typeof Form.Message> & { mode?: Mode; error?: boolean }
>(({ className = '', mode = 'light', error = false, ...props }, ref) => (
  <Form.Message
    ref={ref}
    data-mode={mode}
    data-error={error ? 'true' : 'false'}
    className={`form-message ${className}`.trim()}
    {...props}
  />
));
FormMessage.displayName = 'FormMessage';

export const FormInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <input
    ref={ref}
    data-mode={mode}
    className={`form-input ${className}`.trim()}
    {...props}
  />
));
FormInput.displayName = 'FormInput';

export const FormCoinSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <select
    ref={ref}
    data-mode={mode}
    className={`form-select ${className}`.trim()}
    {...props}
  />
));
FormCoinSelect.displayName = 'FormCoinSelect';

export const FormInputWithButton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <div
    ref={ref}
    data-mode={mode}
    className={`form-input-wrap ${className}`.trim()}
    {...props}
  />
));
FormInputWithButton.displayName = 'FormInputWithButton';

export const FormInputButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { mode?: Mode }
>(({ className = '', mode = 'light', ...props }, ref) => (
  <button
    ref={ref}
    data-mode={mode}
    className={`form-input-btn ${className}`.trim()}
    {...props}
  />
));
FormInputButton.displayName = 'FormInputButton';
