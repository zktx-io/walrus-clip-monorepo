import { FC, StrictMode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  SnackbarProvider as RawSnackbarProvider,
  SnackbarProviderProps,
} from 'notistack';
import { createRoot } from 'react-dom/client';

import './index.css';
import App from './App.tsx';

const queryClient = new QueryClient();
const SnackbarProvider =
  RawSnackbarProvider as unknown as FC<SnackbarProviderProps>;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SnackbarProvider
      anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      hideIconVariant
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </SnackbarProvider>
  </StrictMode>,
);
