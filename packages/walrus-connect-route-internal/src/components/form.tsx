import type {
  ButtonHTMLAttributes,
  ComponentPropsWithoutRef,
  HTMLAttributes,
  InputHTMLAttributes,
  Ref,
  SelectHTMLAttributes,
} from 'react';

import * as Form from '@radix-ui/react-form';

type Mode = 'light' | 'dark';

export const FormRoot = Form.Root;
export const FormControl = Form.Control;

type FormFieldProps = ComponentPropsWithoutRef<typeof Form.Field> & {
  ref?: Ref<HTMLDivElement>;
};

export function FormField({ className = '', ref, ...props }: FormFieldProps) {
  return (
    <Form.Field
      ref={ref}
      className={`form-field ${className}`.trim()}
      {...props}
    />
  );
}

type FormLabelProps = ComponentPropsWithoutRef<typeof Form.Label> & {
  mode?: Mode;
  ref?: Ref<HTMLLabelElement>;
};

export function FormLabel({
  className = '',
  mode = 'light',
  ref,
  ...props
}: FormLabelProps) {
  return (
    <Form.Label
      ref={ref}
      data-mode={mode}
      className={`form-label ${className}`.trim()}
      {...props}
    />
  );
}

type FormMessageProps = ComponentPropsWithoutRef<typeof Form.Message> & {
  mode?: Mode;
  error?: boolean;
  ref?: Ref<HTMLParagraphElement>;
};

export function FormMessage({
  className = '',
  mode = 'light',
  error = false,
  ref,
  ...props
}: FormMessageProps) {
  return (
    <Form.Message
      ref={ref}
      data-mode={mode}
      data-error={error ? 'true' : 'false'}
      className={`form-message ${className}`.trim()}
      {...props}
    />
  );
}

type FormInputProps = InputHTMLAttributes<HTMLInputElement> & {
  mode?: Mode;
  ref?: Ref<HTMLInputElement>;
};

export function FormInput({
  className = '',
  mode = 'light',
  ref,
  ...props
}: FormInputProps) {
  return (
    <input
      ref={ref}
      data-mode={mode}
      className={`form-input ${className}`.trim()}
      {...props}
    />
  );
}

type FormCoinSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  mode?: Mode;
  ref?: Ref<HTMLSelectElement>;
};

export function FormCoinSelect({
  className = '',
  mode = 'light',
  ref,
  ...props
}: FormCoinSelectProps) {
  return (
    <select
      ref={ref}
      data-mode={mode}
      className={`form-select ${className}`.trim()}
      {...props}
    />
  );
}

type FormInputWithButtonProps = HTMLAttributes<HTMLDivElement> & {
  mode?: Mode;
  ref?: Ref<HTMLDivElement>;
};

export function FormInputWithButton({
  className = '',
  mode = 'light',
  ref,
  ...props
}: FormInputWithButtonProps) {
  return (
    <div
      ref={ref}
      data-mode={mode}
      className={`form-input-wrap ${className}`.trim()}
      {...props}
    />
  );
}

type FormInputButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  mode?: Mode;
  ref?: Ref<HTMLButtonElement>;
};

export function FormInputButton({
  className = '',
  mode = 'light',
  ref,
  ...props
}: FormInputButtonProps) {
  return (
    <button
      ref={ref}
      data-mode={mode}
      className={`form-input-btn ${className}`.trim()}
      {...props}
    />
  );
}
