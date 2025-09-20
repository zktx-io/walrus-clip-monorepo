import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

export default {
  input: 'src/index.tsx',
  output: [
    { file: 'dist/index.cjs.js', format: 'cjs', exports: 'named' },
    { file: 'dist/index.esm.js', format: 'esm' },
  ],
  plugins: [
    peerDepsExternal(),

    resolve({ browser: true, preferBuiltins: false }),

    commonjs({ include: /node_modules/ }),

    postcss({
      extensions: ['.css'],
      extract: 'index.css',
      minimize: true,
      modules: false,
      inject: false,
    }),

    typescript({
      tsconfig: './tsconfig.json',
      typescript: await import('typescript').then((ts) => ts.default),
    }),

    terser(),
  ],
  external: [
    // React
    /^react(\/.*)?$/,
    /^react-dom(\/.*)?$/,

    // Radix
    /^@radix-ui\/react-.*/,

    'lucide-react',
    'framer-motion',

    '@mysten/sui',
    '@mysten/dapp-kit',
    '@zktx.io/walrus-connect',

    /^recoil(\/.*)?$/,
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
