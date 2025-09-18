import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      exports: 'named',
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
    },
  ],
  plugins: [
    // Exclude peerDependencies from the bundle
    peerDepsExternal(),

    // Resolve modules in node_modules (browser-compatible)
    resolve({ browser: true, preferBuiltins: false }),

    // Convert CommonJS modules to ES6
    commonjs({ include: /node_modules/ }),

    // Compile TypeScript
    typescript({
      tsconfig: './tsconfig.json',
      typescript: await import('typescript').then((ts) => ts.default),
    }),

    // Minify output
    terser(),
  ],
  external: [
    // React + JSX runtime externals
    /^react(\/.*)?$/,
    /^react-dom(\/.*)?$/,

    // Sui SDK and Dapp Kit must be provided by the consumer
    '@mysten/sui',
    '@mysten/dapp-kit',
  ],
  context: 'this',
  onwarn: (warning, warn) => {
    // Suppress circular dependency and "use client" warnings
    if (
      warning.code === 'CIRCULAR_DEPENDENCY' ||
      warning.message.includes('"use client"')
    ) {
      return;
    }
    warn(warning);
  },
};
