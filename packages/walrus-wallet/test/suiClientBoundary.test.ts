import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  createWalrusWalletSuiClient,
  getWalrusWalletGrpcBaseUrl,
} = await jiti.import<typeof import('../src/utils/suiClient.ts')>(
  '../src/utils/suiClient.ts',
);

test('wallet Sui client boundary owns the gRPC base URL per supported network', () => {
  assert.equal(
    getWalrusWalletGrpcBaseUrl('mainnet'),
    'https://fullnode.mainnet.sui.io:443',
  );
  assert.equal(
    getWalrusWalletGrpcBaseUrl('testnet'),
    'https://fullnode.testnet.sui.io:443',
  );
  assert.equal(
    getWalrusWalletGrpcBaseUrl('devnet'),
    'https://fullnode.devnet.sui.io:443',
  );
});

test('createWalrusWalletSuiClient builds a gRPC transport client for dApp Kit and coin helpers', () => {
  const mainnetClient = createWalrusWalletSuiClient('mainnet');
  assert.equal(mainnetClient.network, 'mainnet');

  const testnetClient = createWalrusWalletSuiClient('testnet');
  assert.equal(testnetClient.network, 'testnet');

  const devnetClient = createWalrusWalletSuiClient('devnet');
  assert.equal(devnetClient.network, 'devnet');
});
