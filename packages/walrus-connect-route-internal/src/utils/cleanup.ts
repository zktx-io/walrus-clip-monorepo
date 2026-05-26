import type { Root } from 'react-dom/client';

const TIME_OUT = 300;

export const cleanup = (container: HTMLDivElement, root: Root) => {
  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, TIME_OUT);
};
