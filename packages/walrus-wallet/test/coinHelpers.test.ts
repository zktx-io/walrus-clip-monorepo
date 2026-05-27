import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CoinBalance, CoinMetadata } from '@mysten/sui/jsonRpc';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  formatWalrusCoinAmount,
  formatWalrusCoinBalance,
} = await jiti.import<typeof import('../src/utils/coinHelpers.ts')>(
  '../src/utils/coinHelpers.ts',
);

const balance = (overrides: Partial<CoinBalance> = {}): CoinBalance => ({
  coinType: '0x2::sui::SUI',
  coinObjectCount: 1,
  totalBalance: '123456789000',
  lockedBalance: {
    epoch: '1000',
  },
  ...overrides,
});

const metadata = (decimals: number): CoinMetadata =>
  ({
    id: null,
    name: 'Walrus Test Coin',
    symbol: 'WTC',
    description: '',
    iconUrl: null,
    decimals,
  }) as CoinMetadata;

test('formats integer raw balances without floating point arithmetic', () => {
  assert.equal(formatWalrusCoinAmount('0', 9), '0');
  assert.equal(formatWalrusCoinAmount('1000000000', 9), '1');
  assert.equal(formatWalrusCoinAmount('123456789000', 9), '123.456789');
  assert.equal(
    formatWalrusCoinAmount('123456789012345678901234567890', 18),
    '123456789012.34567890123456789',
  );
});

test('formats decimals zero as an integer string', () => {
  assert.equal(formatWalrusCoinAmount('12345', 0), '12345');
});

test('does not fabricate display balances without metadata decimals', () => {
  const formatted = formatWalrusCoinBalance(balance(), null);

  assert.equal(formatted.formattedBalance, null);
  assert.equal(formatted.lockedBalance.epoch.formattedBalance, null);
  assert.equal(formatted.metadata, null);
});

test('uses metadata decimals for total and locked display balances', () => {
  const formatted = formatWalrusCoinBalance(balance(), metadata(9));

  assert.equal(formatted.formattedBalance, '123.456789');
  assert.equal(formatted.lockedBalance.epoch.formattedBalance, '0.000001');
  assert.equal(formatted.metadata?.decimals, 9);
});

test('propagates malformed raw balances instead of rounding or fallback formatting', () => {
  assert.throws(() =>
    formatWalrusCoinBalance(
      balance({
        totalBalance: 'not-a-number',
      }),
      metadata(9),
    ),
  );
});
