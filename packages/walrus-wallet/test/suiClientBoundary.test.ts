import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  createWalrusWalletDappKitNetworkConfig,
  getWalrusWalletFullnodeUrl,
} = await jiti.import<typeof import('../src/utils/suiClient.ts')>(
  '../src/utils/suiClient.ts',
);
const { createWalrusWalletDappKitNetworks } = await jiti.import<
  typeof import('../src/utils/dappKitNetworks.ts')
>('../src/utils/dappKitNetworks.ts');

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

test('dApp Kit networks are derived from the wallet Sui boundary', () => {
  assert.deepEqual(createWalrusWalletDappKitNetworkConfig('testnet'), {
    url: 'https://fullnode.testnet.sui.io:443',
  });
  assert.deepEqual(createWalrusWalletDappKitNetworks(), {
    mainnet: { url: 'https://fullnode.mainnet.sui.io:443' },
    testnet: { url: 'https://fullnode.testnet.sui.io:443' },
    devnet: { url: 'https://fullnode.devnet.sui.io:443' },
  });
});
