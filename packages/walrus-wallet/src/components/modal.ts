import * as Dialog from '@radix-ui/react-dialog';
import { keyframes, styled } from '@stitches/react';

export const DlgRoot = styled(Dialog.Root, {});
export const DlgTrigger = styled(Dialog.Trigger, {});
export const DlgPortal = styled(Dialog.Portal, {});

const overlayShow = keyframes({
  from: {
    opacity: 0,
  },
  to: {
    opacity: 1,
  },
});

const contentShow = keyframes({
  from: {
    opacity: 0,
    transform: 'translate(-50%, -48%) scale(0.96)',
  },
  to: {
    opacity: 1,
    transform: 'translate(-50%, -50%) scale(1)',
  },
});

const contentShowBottom = keyframes({
  from: {
    opacity: 0,
    transform: 'translate(-50%, 100%)',
  },
  to: {
    opacity: 1,
    transform: 'translate(-50%, 0)',
  },
});

export type Mode = 'light' | 'dark';

export const DlgOverlay = styled(Dialog.Overlay, {
  zIndex: 2147483645,
  pointerEvents: 'none',
  position: 'fixed',
  inset: 0,
  animation: `${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1)`,
  backdropFilter: 'blur(4px)',
  variants: {
    mode: {
      light: {
        backgroundColor: '#00000066',
      },
      dark: {
        backgroundColor: '#00000099',
      },
    },
  },
});

export const DlgContent = styled(Dialog.DialogContent, {
  zIndex: 2147483645,
  pointerEvents: 'none',
  borderRadius: '6px',
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  maxWidth: '450px',
  maxHeight: '85vh',
  padding: '25px',
  outline: 'none',
  animation: `${contentShow} 150ms cubic-bezier(0.16, 1, 0.3, 1)`,
  variants: {
    mode: {
      light: {
        borderStyle: 'none',
        backgroundColor: '#ffffff',
        boxShadow:
          '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)',
      },
      dark: {
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: '#ddf3ff15',
        backgroundColor: '#191919',
        boxShadow:
          '0 10px 20px rgba(54, 58, 63, 0.1), 0 6px 6px rgba(54, 58, 63, 0.14)',
      },
    },
  },
});

export const DlgContentBottom = styled(Dialog.Content, {
  zIndex: 2147483645,
  position: 'fixed',
  bottom: 0,
  left: '50%',
  transform: 'translateX(-50%)',
  width: '100%',
  maxWidth: '450px',
  maxHeight: '80vh',
  borderRadius: '12px 12px 0 0',
  backgroundColor: '#191919',
  padding: '25px',
  outline: 'none',
  animation: `${contentShowBottom} 1000ms cubic-bezier(0.16, 1, 0.3, 1)`,
  '@media (max-width: 600px)': {
    borderRadius: '12px 12px 0 0',
    height: 'auto',
    maxHeight: '80vh',
    maxWidth: '100%',
  },
  variants: {
    mode: {
      light: {
        borderStyle: 'none',
        color: '#000000',
        backgroundColor: '#ffffff',
        boxShadow:
          '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)',
      },
      dark: {
        borderStyle: 'solid',
        borderWidth: '1px',
        borderColor: '#ddf3ff15',
        color: '#ffffff',
        backgroundColor: '#191919',
        boxShadow:
          '0 10px 20px rgba(54, 58, 63, 0.1), 0 6px 6px rgba(54, 58, 63, 0.14)',
      },
    },
  },
});

export const DlgTitle = styled(Dialog.DialogTitle, {
  margin: 0,
  fontWeight: 700,
  fontSize: '20px',
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

export const DlgDescription = styled(Dialog.DialogDescription, {
  margin: '10px 0 16px',
  opacity: 0.7,
  fontSize: '12px',
  lineHeight: '1.5',
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

export const DlgDescription2 = styled(Dialog.DialogDescription, {
  margin: '10px 0 16px',
  opacity: 0.7,
  fontSize: '12px',
  lineHeight: '1.5',
  textAlign: 'center',
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

export const DlgClose = styled('button', {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  borderRadius: '50%',
  padding: '0px',
  height: '24px',
  width: '24px',
  outline: 'none',
  border: 'none',
  variants: {
    mode: {
      light: {
        color: '#0005119e',
        backgroundColor: '#ffffff00',
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: '#afafaf8a',
        },
        '&:disabled': {
          cursor: 'default',
          color: '#00082f46',
          backgroundColor: '#0101370f',
        },
      },
      dark: {
        color: '#f1f7ffb5',
        backgroundColor: '#19191900',
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: '#afafaf8a',
        },
        '&:disabled': {
          cursor: 'default',
          color: '#daf0ff5c',
          backgroundColor: '#deeeff14',
        },
      },
    },
  },
});

export const DlgButton = styled('button', {
  height: '32px',
  paddingLeft: '12px',
  paddingRight: '12px',
  fontWeight: 500,
  fontSize: '14px',
  outline: 'none',
  borderRadius: '4px',
  border: 'none',
  variants: {
    mode: {
      light: {
        color: '#0005119e',
        backgroundColor: '#0101370f',
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: '#afafaf8a',
        },
        '&:disabled': {
          cursor: 'default',
          color: '#00082f46',
          backgroundColor: '#0101370f',
        },
      },
      dark: {
        color: '#f1f7ffb5',
        backgroundColor: '#deeeff14',
        '&:hover': {
          cursor: 'pointer',
          backgroundColor: '#afafaf8a',
        },
        '&:disabled': {
          cursor: 'default',
          color: '#daf0ff5c',
          backgroundColor: '#deeeff14',
        },
      },
    },
  },
});
