import assert from 'node:assert/strict';
import test from 'node:test';

import { Transaction } from '@mysten/sui/transactions';
import { toBase64 } from '@mysten/sui/utils';

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

type TestSimulationResult = Awaited<
  ReturnType<
    Parameters<typeof createSignTransactionReview>[0]['client']['core']['simulateTransaction']
  >
>;

const createClient = (
  simulation: TestSimulationResult | (() => Promise<TestSimulationResult>),
): Parameters<typeof createSignTransactionReview>[0]['client'] =>
  ({
    core: {
      simulateTransaction:
        typeof simulation === 'function' ? simulation : async () => simulation,
    },
  }) as unknown as Parameters<typeof createSignTransactionReview>[0]['client'];

const createDryRun = (
  status: 'success' | 'failure' = 'success',
): TestSimulationResult => {
  const transaction = {
    digest: 'simulation-digest',
    balanceChanges:
      status === 'success'
        ? [
            {
              address: ADDRESS_ONE,
              coinType: '0x2::sui::SUI',
              amount: '-100',
            },
          ]
        : [],
    effects: {
      status:
        status === 'success'
          ? { success: true, error: null }
          : { success: false, error: { message: 'Insufficient gas' } },
      changedObjects:
        status === 'success'
          ? [
              {
                objectId: OBJECT_ID,
                inputState: 'Exists',
                inputVersion: '6',
                inputDigest: 'input-digest',
                inputOwner: { $kind: 'AddressOwner', AddressOwner: ADDRESS_ONE },
                outputState: 'ObjectWrite',
                outputVersion: '7',
                outputDigest: 'object-digest',
                outputOwner: { $kind: 'AddressOwner', AddressOwner: ADDRESS_TWO },
                idOperation: 'None',
              },
            ]
          : [],
    },
    events:
      status === 'success'
        ? [
            {
              packageId: '0x2',
              module: 'pay',
              sender: ADDRESS_ONE,
              eventType: '0x2::pay::Paid',
              json: { amount: '100' },
            },
          ]
        : [],
  };

  return (status === 'success'
    ? {
        $kind: 'Transaction',
        Transaction: transaction,
        commandResults: undefined,
      }
    : {
        $kind: 'FailedTransaction',
        FailedTransaction: transaction,
        commandResults: undefined,
      }) as unknown as TestSimulationResult;
};

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
    bytes: toBase64(new Uint8Array([1])),
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
    bytes: toBase64(new Uint8Array([1])),
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
    owner: ADDRESS_ONE,
    coinType: '0x2::sui::SUI',
    amount: '-100',
    summary: `-100 0x2::sui::SUI for ${ADDRESS_ONE}`,
  });
  assert.equal(review.dryRun.objectChanges[0].type, 'Exists -> ObjectWrite');
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
    bytes: toBase64(new Uint8Array([1])),
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
    bytes: toBase64(new Uint8Array([1])),
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
