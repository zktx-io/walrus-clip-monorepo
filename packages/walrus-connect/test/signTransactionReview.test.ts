import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  DryRunTransactionBlockResponse,
  SuiJsonRpcClient,
} from '@mysten/sui/jsonRpc';
import { Transaction } from '@mysten/sui/transactions';

import {
  approveSignTransactionReview,
  createSignTransactionReview,
  deriveSignTransactionSponsorship,
  formatSignTransactionReview,
  getTransactionSenderValidationError,
} from '../src/utils/signTransactionReview.ts';

const ADDRESS_ONE =
  '0x0000000000000000000000000000000000000000000000000000000000000001';
const ADDRESS_TWO =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const FRAMEWORK_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000002';
const OBJECT_ID =
  '0x0000000000000000000000000000000000000000000000000000000000000005';

const createClient = (
  dryRun:
    | DryRunTransactionBlockResponse
    | (() => Promise<DryRunTransactionBlockResponse>),
): SuiJsonRpcClient =>
  ({
    dryRunTransactionBlock:
      typeof dryRun === 'function' ? dryRun : async () => dryRun,
  }) as unknown as SuiJsonRpcClient;

const createDryRun = (
  status: 'success' | 'failure' = 'success',
): DryRunTransactionBlockResponse =>
  ({
    balanceChanges:
      status === 'success'
        ? [
            {
              owner: { AddressOwner: ADDRESS_ONE },
              coinType: '0x2::sui::SUI',
              amount: '-100',
            },
          ]
        : [],
    effects: {
      status:
        status === 'success'
          ? { status: 'success' }
          : { status: 'failure', error: 'Insufficient gas' },
    },
    events:
      status === 'success'
        ? [
            {
              id: { txDigest: 'dry-run-digest', eventSeq: '0' },
              packageId: '0x2',
              transactionModule: 'pay',
              sender: ADDRESS_ONE,
              type: '0x2::pay::Paid',
              parsedJson: { amount: '100' },
            },
          ]
        : [],
    input: {},
    objectChanges:
      status === 'success'
        ? [
            {
              type: 'transferred',
              sender: ADDRESS_ONE,
              recipient: { AddressOwner: ADDRESS_TWO },
              objectId: OBJECT_ID,
              objectType: '0x2::coin::Coin<0x2::sui::SUI>',
              version: '7',
              digest: 'object-digest',
            },
          ]
        : [],
  }) as unknown as DryRunTransactionBlockResponse;

const createReviewTransaction = (gasOwner = ADDRESS_ONE) => {
  const tx = new Transaction();
  tx.setSender(ADDRESS_ONE);
  tx.setGasOwner(gasOwner);
  const coin = tx.splitCoins(tx.gas, [tx.pure.u64(100n)]);
  tx.transferObjects([coin], ADDRESS_TWO);
  tx.moveCall({
    target: '0x2::pay::pay',
    arguments: [tx.object(OBJECT_ID)],
  });
  return tx;
};

test('requires transaction sender before signing', () => {
  const tx = new Transaction();

  assert.deepEqual(getTransactionSenderValidationError(tx, ADDRESS_ONE), {
    code: 'transaction_validation_failed',
    message: 'Transaction is missing sender',
  });
});

test('rejects sender mismatch before signing', () => {
  const tx = new Transaction();
  tx.setSender(ADDRESS_ONE);

  assert.deepEqual(getTransactionSenderValidationError(tx, ADDRESS_TWO), {
    code: 'transaction_validation_failed',
    message: 'Transaction sender does not match signer address',
  });
});

test('accepts matching normalized sender before signing', () => {
  const tx = new Transaction();
  tx.setSender(ADDRESS_ONE);

  assert.equal(getTransactionSenderValidationError(tx, ADDRESS_ONE), undefined);
});

test('rejects dry-run failure before creating review approval', async () => {
  const result = await createSignTransactionReview({
    tx: createReviewTransaction(),
    client: createClient(createDryRun('failure')),
    bytes: 'request-bytes',
    network: 'testnet',
  });

  assert.deepEqual(result, {
    ok: false,
    error: {
      code: 'transaction_validation_failed',
      message: 'Transaction dry run failed: Insufficient gas',
    },
  });
});

test('creates review with concrete command and dry-run facts', async () => {
  const result = await createSignTransactionReview({
    tx: createReviewTransaction(ADDRESS_TWO),
    client: createClient(createDryRun()),
    bytes: 'request-bytes',
    network: 'testnet',
  });

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail(result.error.message);

  const { review } = result;
  assert.equal(review.sender, ADDRESS_ONE);
  assert.equal(review.sponsored, true);

  const split = review.commands.find((command) => command.kind === 'SplitCoins');
  assert.ok(split);
  assert.match(split.summary, /100/);

  const transfer = review.commands.find(
    (command) => command.kind === 'TransferObjects',
  );
  assert.ok(transfer);
  assert.match(transfer.summary, new RegExp(ADDRESS_TWO));

  const moveCall = review.commands.find(
    (command) => command.kind === 'MoveCall',
  );
  assert.ok(moveCall);
  assert.match(moveCall.summary, new RegExp(`${FRAMEWORK_ADDRESS}::pay::pay`));

  assert.deepEqual(review.dryRun.balanceChanges[0], {
    index: 0,
    owner: `AddressOwner: ${ADDRESS_ONE}`,
    coinType: '0x2::sui::SUI',
    amount: '-100',
    summary: `-100 0x2::sui::SUI for AddressOwner: ${ADDRESS_ONE}`,
  });
  assert.equal(review.dryRun.objectChanges[0].type, 'transferred');
  assert.equal(review.dryRun.events[0].type, '0x2::pay::Paid');

  const formatted = formatSignTransactionReview(review);
  assert.match(formatted, new RegExp(`Move call ${FRAMEWORK_ADDRESS}::pay::pay`));
  assert.match(formatted, /Balance changes/);
  assert.match(formatted, /Object changes/);
  assert.doesNotMatch(formatted, /commandCount/);
});

test('derives sponsorship from gas owner relative to sender', async () => {
  const selfFunded = createReviewTransaction(ADDRESS_ONE);
  const sponsored = createReviewTransaction(ADDRESS_TWO);

  assert.deepEqual(deriveSignTransactionSponsorship(selfFunded), {
    sponsored: false,
    status: 'self-funded',
    gasOwner: ADDRESS_ONE,
  });
  assert.deepEqual(deriveSignTransactionSponsorship(sponsored), {
    sponsored: true,
    status: 'sponsored',
    gasOwner: ADDRESS_TWO,
  });

  const result = await createSignTransactionReview({
    tx: selfFunded,
    client: createClient(createDryRun()),
    bytes: 'request-bytes',
    network: 'testnet',
  });

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail(result.error.message);

  assert.equal(result.review.sponsored, false);
  const formatted = formatSignTransactionReview(result.review);
  assert.match(formatted, /Sponsored: no/);
});

test('turns user rejection into a structured validation error', async () => {
  const result = await createSignTransactionReview({
    tx: createReviewTransaction(),
    client: createClient(createDryRun()),
    bytes: 'request-bytes',
    network: 'testnet',
  });

  assert.equal(result.ok, true);
  if (!result.ok) assert.fail(result.error.message);

  assert.deepEqual(
    await approveSignTransactionReview(result.review, () => false),
    {
      ok: false,
      error: {
        code: 'transaction_rejected',
        message: 'User rejected transaction review',
      },
    },
  );
});
