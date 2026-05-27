import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url);

const {
  formatWalrusCoinAmount,
  formatWalrusCoinBalance,
} = await jiti.import<typeof import('../src/utils/coinHelpers.ts')>(
  '../src/utils/coinHelpers.ts',
);

type TestCoinBalance = Parameters<typeof formatWalrusCoinBalance>[0];
type TestCoinMetadata = NonNullable<
  Parameters<typeof formatWalrusCoinBalance>[1]
>;

const balance = (overrides: Partial<TestCoinBalance> = {}): TestCoinBalance => ({
  coinType: '0x2::sui::SUI',
  balance: '123456789000',
  coinBalance: '123456789000',
  addressBalance: '123456789000',
  ...overrides,
});

const metadata = (decimals: number): TestCoinMetadata => ({
  id: null,
  name: 'Walrus Test Coin',
  symbol: 'WTC',
  description: '',
  iconUrl: null,
  decimals,
});

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
  assert.equal(formatted.metadata, null);
});

test('uses metadata decimals for total display balances', () => {
  const formatted = formatWalrusCoinBalance(balance(), metadata(9));

  assert.equal(formatted.formattedBalance, '123.456789');
  assert.equal(formatted.metadata?.decimals, 9);
});

test('propagates malformed raw balances instead of rounding or fallback formatting', () => {
  assert.throws(() =>
    formatWalrusCoinBalance(
      balance({
        balance: 'not-a-number',
      }),
      metadata(9),
    ),
  );
});
