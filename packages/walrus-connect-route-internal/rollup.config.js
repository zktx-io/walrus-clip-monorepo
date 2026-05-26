import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

const closeLeakedTypeScriptWatchers = () => ({
  name: 'close-leaked-typescript-watchers',
  closeBundle() {
    if (this.meta.watchMode) return;

    const getActiveHandles = process._getActiveHandles;
    if (typeof getActiveHandles !== 'function') return;

    for (const handle of getActiveHandles.call(process)) {
      const name = handle?.constructor?.name;
      if (name !== 'FSWatcher' && name !== 'StatWatcher') continue;

      if (typeof handle.close === 'function') handle.close();
      if (typeof handle.stop === 'function') handle.stop();
    }
  },
});

export default {
  input: '.rollup/index.js',
  output: [
    { file: 'dist/index.cjs.js', format: 'cjs', exports: 'named' },
    { file: 'dist/index.esm.js', format: 'esm' },
  ],
  plugins: [
    peerDepsExternal(),

    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
    }),

    commonjs({ include: /node_modules/ }),

    terser(),

    closeLeakedTypeScriptWatchers(),
  ],
  external: [
    /^react(\/.*)?$/,
    /^react-dom(\/.*)?$/,
    /^@mysten\/sui(\/.*)?$/,
    /^@mysten\/wallet-standard(\/.*)?$/,
    /^@radix-ui\/react-.+$/,
    /^@yudiel\/react-qr-scanner$/,
    /^react-qrcode-logo$/,
    /^peerjs$/,
    /^lucide-react$/,
  ],
  context: 'this',
  onwarn: (warning, warn) => {
    if (
      warning.code === 'CIRCULAR_DEPENDENCY' ||
      warning.message.includes('"use client"')
    ) {
      return;
    }
    warn(warning);
  },
};
