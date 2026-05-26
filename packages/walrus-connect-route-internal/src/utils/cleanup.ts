import ReactDOM from 'react-dom/client';

const TIME_OUT = 300;

export const cleanup = (container: HTMLDivElement, root: ReactDOM.Root) => {
  setTimeout(() => {
    root.unmount();
    document.body.removeChild(container);
  }, TIME_OUT);
};
