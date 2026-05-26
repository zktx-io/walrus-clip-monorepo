import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const { createWalrusWalletSuiClient, getWalrusWalletFullnodeUrl } =
  await jiti.import<typeof import('../src/utils/suiClient.ts')>(
    '../src/utils/suiClient.ts',
  );

test('wallet Sui client boundary owns fullnode URL selection', () => {
  assert.equal(
    getWalrusWalletFullnodeUrl('mainnet'),
    'https://fullnode.mainnet.sui.io:443',
  );
  assert.equal(
    getWalrusWalletFullnodeUrl('testnet'),
    'https://fullnode.testnet.sui.io:443',
  );
  assert.equal(
    getWalrusWalletFullnodeUrl('devnet'),
    'https://fullnode.devnet.sui.io:443',
  );
});

test('createWalrusWalletSuiClient routes each network to the matching JSON-RPC client', () => {
  const mainnetClient = createWalrusWalletSuiClient('mainnet');
  assert.equal(mainnetClient.network, 'mainnet');

  const testnetClient = createWalrusWalletSuiClient('testnet');
  assert.equal(testnetClient.network, 'testnet');

  const devnetClient = createWalrusWalletSuiClient('devnet');
  assert.equal(devnetClient.network, 'devnet');
});
