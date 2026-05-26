import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

export default {
  input: {
    index: '.rollup/walrus-connect/src/index.js',
    'signer-app': '.rollup/walrus-connect/src/signer-app.js',
  },
  output: [
    {
      dir: 'dist',
      format: 'cjs',
      entryFileNames: '[name].cjs.js',
      exports: 'named',
    },
    {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].esm.js',
    },
  ],
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

    terser(),
  ],
  external: [
    /^react(\/.*)?$/,
    /^react-dom(\/.*)?$/,
    /^@mysten\/sui(\/.*)?$/,
    /^@radix-ui\/react-.+$/,
    /^@yudiel\/react-qr-scanner$/,
    /^react-qrcode-logo$/,
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
