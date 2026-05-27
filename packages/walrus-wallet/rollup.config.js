import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

const closeLeakedTypeScriptWatchers = () => ({
  name: 'close-leaked-typescript-watchers',
  closeBundle() {
    if (this.meta.watchMode) return;

    // @rollup/plugin-typescript can leave TS filesystem watchers open after a one-shot build.
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
  input: 'src/index.tsx',
  output: [{ file: 'dist/index.esm.js', format: 'esm' }],
  plugins: [
    peerDepsExternal(),

    resolve({
      browser: true,
      preferBuiltins: false,
      extensions: ['.mjs', '.js', '.json', '.node', '.ts', '.tsx'],
    }),

    commonjs({ include: /node_modules/ }),

    postcss({
      extensions: ['.css'],
      extract: 'index.css',
      minimize: true,
      modules: false,
      inject: false,
    }),

    typescript({ tsconfig: './tsconfig.json' }),

    terser(),

    closeLeakedTypeScriptWatchers(),
  ],
  external: [
    /^react(\/.*)?$/,
    /^react-dom(\/.*)?$/,
    /^@radix-ui\/react-.*/,
    /^@mysten\/sui(\/.*)?$/,
    /^@mysten\/dapp-kit(\/.*)?$/,
    '@zktx.io/walrus-connect',
    'lucide-react',
    'framer-motion',
  ],
  context: 'this',
  onwarn: (warning, warn) => {
    if (
      warning.code === 'CIRCULAR_DEPENDENCY' ||
      warning.message.includes('"use client"')
    )
      return;
    warn(warning);
  },
};
