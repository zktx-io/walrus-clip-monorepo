import { FC, StrictMode } from 'react';

import {
  SnackbarProvider as RawSnackbarProvider,
  SnackbarProviderProps,
} from 'notistack';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.tsx';

const SnackbarProvider =
  RawSnackbarProvider as unknown as FC<SnackbarProviderProps>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SnackbarProvider
      anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      hideIconVariant
    >
      <App />
    </SnackbarProvider>
  </StrictMode>,
);
