import type { Root } from 'react-dom/client';

type WalletModalContainer = {
  container: HTMLDivElement;
  portalContainer?: HTMLDivElement;
  topLayerHost?: HTMLDialogElement;
};

const styleTopLayerHost = (host: HTMLDialogElement) => {
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.width = '100vw';
  host.style.height = '100vh';
  host.style.maxWidth = 'none';
  host.style.maxHeight = 'none';
  host.style.margin = '0';
  host.style.padding = '0';
  host.style.border = '0';
  host.style.background = 'transparent';
  host.style.color = 'inherit';
  host.style.overflow = 'visible';
};

export const createWalletModalContainer = ({
  topLayer = false,
}: {
  topLayer?: boolean;
} = {}): WalletModalContainer => {
  const container = document.createElement('div');

  if (!topLayer || typeof HTMLDialogElement === 'undefined') {
    document.body.appendChild(container);
    return { container };
  }

  const topLayerHost = document.createElement('dialog');
  const portalContainer = document.createElement('div');
  styleTopLayerHost(topLayerHost);
  // Wallet connect can be launched from dApp Kit's native dialog; use the
  // browser top layer so QR/zkLogin prompts are not hidden behind that dialog.
  topLayerHost.addEventListener('cancel', (event) => event.preventDefault());
  topLayerHost.appendChild(container);
  topLayerHost.appendChild(portalContainer);
  document.body.appendChild(topLayerHost);

  try {
    if (typeof topLayerHost.showModal !== 'function') {
      throw new Error('HTMLDialogElement.showModal is unavailable.');
    }
    topLayerHost.showModal();
    return { container, portalContainer, topLayerHost };
  } catch {
    document.body.removeChild(topLayerHost);
    document.body.appendChild(container);
    return { container };
  }
};

export const cleanupWalletModalRoot = (
  container: HTMLDivElement,
  root: Root,
  topLayerHost?: HTMLDialogElement,
) => {
  // Use requestAnimationFrame to ensure React finishes its work before cleanup
  requestAnimationFrame(() => {
    try {
      root.unmount();
    } catch {}
    try {
      if (topLayerHost) {
        if (topLayerHost.open) topLayerHost.close();
        if (document.body.contains(topLayerHost)) {
          document.body.removeChild(topLayerHost);
        }
        return;
      }
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    } catch {}
  });
};
