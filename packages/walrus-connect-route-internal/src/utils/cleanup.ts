import type { Root } from 'react-dom/client';

export const cleanupQrModalRoot = (container: HTMLDivElement, root: Root) => {
  // Use requestAnimationFrame to ensure React finishes its work before cleanup
  requestAnimationFrame(() => {
    try {
      root.unmount();
    } catch {}
    try {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    } catch {}
  });
};
