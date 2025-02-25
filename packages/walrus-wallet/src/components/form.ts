import * as Form from '@radix-ui/react-form';
import { styled } from '@stitches/react';

export const FormRoot = styled(Form.Root, {});
export const FormControl = styled(Form.Control, {});

export const FormField = styled(Form.Field, {
  display: 'grid',
  marginBottom: '10px',
});

export const FormLabel = styled(Form.Label, {
  fontSize: '12px',
  opacity: 0.8,
  fontWeight: 600,
  lineHeight: '16px',
  variants: {
    mode: {
      light: {
        color: '#000000',
      },
      dark: {
        color: '#ffffff',
      },
    },
  },
});

export const FormMessage = styled(Form.Message, {
  fontSize: '12px',
  opacity: 0.75,
  textAlign: 'end',
  variants: {
    mode: {
      light: {
        color: '#000000',
      },
      dark: {
        color: '#ffffff',
      },
    },
    error: {
      true: {
        color: '#d32f2f',
      },
    },
  },
  compoundVariants: [
    {
      mode: 'light',
      error: false,
      css: {
        color: '#000000',
      },
    },
    {
      mode: 'light',
      error: true,
      css: {
        color: '#d32f2f',
      },
    },
    {
      mode: 'dark',
      error: false,
      css: {
        color: '#ffffff',
      },
    },
    {
      mode: 'dark',
      error: true,
      css: {
        color: '#ffa726',
      },
    },
  ],
});

export const FormInput = styled('input', {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  fontSize: '14px',
  height: '28px',
  textIndent: '15px',
  outline: 'none',
  borderStyle: 'solid',
  borderWidth: '1px',
  backgroundColor: '#00000000',
  variants: {
    mode: {
      light: {
        color: '#000000',
        borderColor: '#01013740',
        '&:focus': {
          outline: 'none',
          borderStyle: 'solid',
          borderWidth: '1px',
          borderColor: '#3c74ff',
        },
      },
      dark: {
        color: '#ffffff',
        borderColor: '#ddf3ff40',
        '&:focus': {
          outline: 'none',
          borderStyle: 'solid',
          borderWidth: '1px',
          borderColor: '#33a8ff',
        },
      },
    },
  },
});

export const FormCoinSelect = styled('select', {
  borderRadius: '4px',
  fontSize: '14px',
  padding: '6px',
  borderStyle: 'solid',
  borderWidth: '1px',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  outline: 'none',
  variants: {
    mode: {
      light: {
        color: '#000000',
        borderColor: '#01013740',
        '&:focus': { borderColor: '#3c74ff' },
      },
      dark: {
        color: '#ffffff',
        borderColor: '#ddf3ff40',
        '&:focus': { borderColor: '#33a8ff' },
      },
    },
  },
});

export const FormInputWithButton = styled('div', {
  display: 'flex',
  alignItems: 'center',
  borderRadius: '4px',
  borderStyle: 'solid',
  borderWidth: '1px',
  variants: {
    mode: {
      light: {
        borderColor: '#01013740',
        '&:focus-within': { borderColor: '#3c74ff' },
      },
      dark: {
        borderColor: '#ddf3ff40',
        '&:focus-within': { borderColor: '#33a8ff' },
      },
    },
  },
});

export const FormInputButton = styled('button', {
  background: 'transparent',
  border: 'none',
  padding: '6px 10px',
  fontSize: '12px',
  cursor: 'pointer',
  variants: {
    mode: {
      light: { color: '#000000' },
      dark: { color: '#ffffff' },
    },
  },
});
