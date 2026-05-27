import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

import {
  createProtocolMessage,
  parseProtocolMessage,
  type ProtocolEnvelope,
  type ProtocolMessageType,
} from '../../walrus-connect-route-internal/src/utils/message.ts';
import type { SignHostRunnerDeps } from '../../walrus-connect-route-internal/src/protocol/signHostRunner.ts';
import type { QRSignOutcome } from '../../walrus-connect-route-internal/src/protocol/signLifecycle.ts';
import type { ProtocolTransport } from '../../walrus-connect-route-internal/src/protocol/session.ts';

const jiti = createJiti(import.meta.url);
const { startSignHostRunner, QRSignOutcomeError } = await jiti.import<{
  startSignHostRunner: typeof import('../../walrus-connect-route-internal/src/protocol/signHostRunner.ts').startSignHostRunner;
  QRSignOutcomeError: typeof import('../../walrus-connect-route-internal/src/protocol/signLifecycle.ts').QRSignOutcomeError;
}>('../../walrus-connect-route-internal/src/protocol/signHostRunner.ts');
const { createSignHostFailureOutcome } = await jiti.import<{
  createSignHostFailureOutcome: typeof import('../../walrus-connect-route-internal/src/protocol/signLifecycle.ts').createSignHostFailureOutcome;
}>('../../walrus-connect-route-internal/src/protocol/signLifecycle.ts');

class FakeTransport implements ProtocolTransport {
  sent: string[] = [];
  closed = false;
  closeReason: string | undefined;
  onSend?: (raw: string, transport: FakeTransport) => void;
  #messageHandlers: Array<(raw: unknown) => void> = [];
  #closeHandlers: Array<() => void> = [];
  #errorHandlers: Array<(error: Error) => void> = [];

  constructor(onSend?: (raw: string, transport: FakeTransport) => void) {
    this.onSend = onSend;
  }

  send(raw: string) {
    if (this.closed) throw new Error('transport closed');
    this.sent.push(raw);
    this.onSend?.(raw, this);
  }

  close(reason?: string) {
    this.closed = true;
    this.closeReason = reason;
  }

  isOpen() {
    return !this.closed;
  }

  onMessage(handler: (raw: unknown) => void) {
    this.#messageHandlers.push(handler);
    return () => {
      this.#messageHandlers = this.#messageHandlers.filter(
        (item) => item !== handler,
      );
    };
  }

  onClose(handler: () => void) {
    this.#closeHandlers.push(handler);
    return () => {
      this.#closeHandlers = this.#closeHandlers.filter(
        (item) => item !== handler,
      );
    };
  }

  onError(handler: (error: Error) => void) {
    this.#errorHandlers.push(handler);
    return () => {
      this.#errorHandlers = this.#errorHandlers.filter(
        (item) => item !== handler,
      );
    };
  }

  emitMessage(raw: unknown) {
    for (const handler of this.#messageHandlers) handler(raw);
  }

  emitClose() {
    for (const handler of this.#closeHandlers) handler();
  }
}

const sessionId = 'session-1';
const network = 'testnet';
const signerAddress = `0x${'1'.repeat(64)}`;

const protocolMessageTypes = [
  'login.proof',
  'login.result',
  'login.result.ack',
  'sign.address',
  'sign.transaction',
  'sign.response',
  'sign.submitted',
  'sign.submitted.ack',
  'sign.finalized',
  'sign.finalized.ack',
  'protocol.error',
  'protocol.error.ack',
] as const satisfies readonly ProtocolMessageType[];

const payloadFor = <TType extends ProtocolMessageType>(
  type: TType,
): ProtocolEnvelope<TType>['payload'] => {
  switch (type) {
    case 'login.proof':
      return {
        address: signerAddress,
        publicKey: 'public-key-1',
        signature: 'signature-1',
        challenge: 'login-challenge',
      } as ProtocolEnvelope<TType>['payload'];
    case 'login.result':
      return {
        accepted: true,
        address: signerAddress,
      } as ProtocolEnvelope<TType>['payload'];
    case 'login.result.ack':
      return {
        accepted: true,
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.address':
      return { address: signerAddress } as ProtocolEnvelope<TType>['payload'];
    case 'sign.transaction':
      return { bytes: 'bytes-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.response':
      return { signature: 'signature-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.submitted':
      return { digest: 'digest-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.submitted.ack':
      return {
        digest: 'digest-1',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.finalized':
      return {
        digest: 'digest-1',
        effects: 'effects-1',
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.finalized.ack':
      return {
        digest: 'digest-1',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'protocol.error':
      return {
        code: 'transaction_rejected',
        message: 'remote rejected',
      } as ProtocolEnvelope<TType>['payload'];
    case 'protocol.error.ack':
      return {
        code: 'transaction_rejected',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
  }
};

const waitFor = async (predicate: () => boolean, label: string) => {
  for (let index = 0; index < 50; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  assert.fail(`Timed out waiting for ${label}`);
};

const createDeferred = <TValue>() => {
  let resolve!: (value: TValue) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<TValue>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const parseSent = <TType extends ProtocolMessageType>(
  raw: string,
  expectedType: TType,
) =>
  parseProtocolMessage(raw, {
    expectedSessionId: sessionId,
    expectedNetwork: network,
    expectedType,
  });

const findSent = <TType extends ProtocolMessageType>(
  transport: FakeTransport,
  expectedType: TType,
) => {
  for (const raw of transport.sent) {
    try {
      return parseSent(raw, expectedType);
    } catch {}
  }
  return undefined;
};

const emitHostInbound = <TType extends ProtocolMessageType>({
  transport,
  sequence,
  type,
  payload,
}: {
  transport: FakeTransport;
  sequence: number;
  type: TType;
  payload: ProtocolEnvelope<TType>['payload'];
}) => {
  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence,
      type,
      payload,
    }),
  );
};

type CoreExecuteResult = {
  $kind: 'Transaction';
  Transaction: { digest: string };
};

type CoreWaitResult = {
  $kind: 'Transaction';
  Transaction: { effects: { bcs: Uint8Array } };
};

const executeSuccess = (digest: string): CoreExecuteResult => ({
  $kind: 'Transaction',
  Transaction: { digest },
});

const waitWithEffects = (bcs: Uint8Array): CoreWaitResult => ({
  $kind: 'Transaction',
  Transaction: { effects: { bcs } },
});

const fakeCoreClient = ({
  executeTransaction,
  waitForTransaction,
}: {
  executeTransaction: () => Promise<CoreExecuteResult>;
  waitForTransaction: () => Promise<CoreWaitResult>;
}) =>
  ({
    core: { executeTransaction, waitForTransaction },
  }) as unknown as ReturnType<SignHostRunnerDeps['createClient']>;

const createDeps = ({
  executeDigest = 'digest-1',
  waitForTransaction,
}: {
  executeDigest?: string;
  waitForTransaction?: () => Promise<CoreWaitResult>;
} = {}): SignHostRunnerDeps => ({
  createClient: () =>
    ({
      core: {
        executeTransaction: async () => executeSuccess(executeDigest),
        waitForTransaction:
          waitForTransaction ??
          (async () => waitWithEffects(new Uint8Array([9, 9, 9]))),
      },
    }) as unknown as ReturnType<SignHostRunnerDeps['createClient']>,
  createTransactionFromJson: () => ({
    setSenderIfNotSet: () => {},
    build: async () => new Uint8Array([1, 2, 3]),
  }),
  encodeBytes: (bytes) => Array.from(bytes).join(','),
  verifyPendingTransactionSignature: async () => {},
});

test('preserves submitted digest when delivery fails after non-sponsored execution', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      currentTransport.emitClose();
    }
  });
  const outcomes: unknown[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({ executeDigest: 'digest-executed' }),
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => outcomes.length === 1, 'submitted delivery outcome');

  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-executed',
    reason: 'Connection closed before protocol delivery completed.',
  });
});

test('separates finalized chain result from finalization delivery failure', async () => {
  let submittedSequence = 0;
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      submittedSequence = message.sequence;
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'sign.submitted.ack',
        payload: {
          digest: message.payload.digest,
          ackSequence: submittedSequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({ executeDigest: 'digest-finalized' }),
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => outcomes.length === 1, 'finalized delivery outcome');

  assert.deepEqual(outcomes[0], {
    type: 'finalized_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-finalized',
    effects: '9,9,9',
    reason: 'Transaction was finalized, but finalization delivery failed.',
  });
});

test('preserves remote terminal reason when execution succeeds after protocol error', async () => {
  const execution = createDeferred<{ digest: string }>();
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        const { digest } = await execution.promise;
        return executeSuccess(digest);
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => executeStarted, 'transaction execution');

  emitHostInbound({
    transport,
    sequence: 3,
    type: 'protocol.error',
    payload: {
      code: 'transaction_rejected',
      message: 'Remote rejected after signing',
    },
  });
  execution.resolve({ digest: 'digest-after-remote-error' });

  await waitFor(() => outcomes.length === 1, 'remote terminal outcome');

  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-after-remote-error',
    reason: 'transaction_rejected: Remote rejected after signing',
  });
});

test('remote close before verification completes prevents execution', async () => {
  const verification = createDeferred<void>();
  let verificationStarted = false;
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.verifyPendingTransactionSignature = async () => {
    verificationStarted = true;
    return verification.promise;
  };
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        return executeSuccess('digest-should-not-execute');
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => verificationStarted, 'signature verification');

  transport.emitClose();
  await waitFor(() => outcomes.length === 1, 'remote close outcome');
  verification.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(executeStarted, false);
  assert.deepEqual(outcomes[0], {
    type: 'failed_before_submit',
    reason: 'Connection closed before transaction submission.',
  });
});

test('serializes duplicate addresses so transaction is built once', async () => {
  let buildCount = 0;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createTransactionFromJson = () => ({
    setSenderIfNotSet: () => {},
    build: async () => {
      buildCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Uint8Array([1, 2, 3]);
    },
  });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 15, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.address',
    payload: { address: signerAddress },
  });

  await waitFor(() => outcomes.length === 1, 'duplicate address rejection');

  assert.equal(buildCount, 1);
  assert.deepEqual(outcomes[0], {
    type: 'failed_before_submit',
    reason: 'type_mismatch: Unexpected sign protocol message',
  });
});

test('QRSignOutcomeError preserves partial chain outcome', () => {
  const outcome = {
    type: 'submitted_delivery_failed' as const,
    bytes: 'bytes-1',
    signature: 'signature-1',
    digest: 'digest-1',
    reason: 'delivery failed',
  };
  const error = new QRSignOutcomeError(outcome);

  assert.equal(error.message, 'delivery failed Digest: digest-1');
  assert.equal(error.outcome, outcome);
});

test('cancel before execute prevents execution', async () => {
  const verification = createDeferred<void>();
  let verificationStarted = false;
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.verifyPendingTransactionSignature = async () => {
    verificationStarted = true;
    return verification.promise;
  };
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        return executeSuccess('digest-should-not-execute');
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  const runner = startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => verificationStarted, 'signature verification');
  runner.cancel('User closed');
  verification.resolve();

  await waitFor(() => outcomes.length === 1, 'pre-execute cancel outcome');
  assert.equal(executeStarted, false);
  assert.deepEqual(outcomes[0], {
    type: 'failed_before_submit',
    reason: 'User closed',
  });
});

test('cancel during execute preserves submitted digest', async () => {
  const execution = createDeferred<{ digest: string }>();
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        const { digest } = await execution.promise;
        return executeSuccess(digest);
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  const runner = startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => executeStarted, 'transaction execution');
  runner.cancel('User closed');
  execution.resolve({ digest: 'digest-after-cancel' });

  await waitFor(() => outcomes.length === 1, 'execute cancel outcome');
  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-after-cancel',
    reason: 'User closed',
  });
});

test('dispose during execute preserves submitted digest instead of going silent', async () => {
  const execution = createDeferred<{ digest: string }>();
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        const { digest } = await execution.promise;
        return executeSuccess(digest);
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  const runner = startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () => findSent(transport, 'sign.transaction') !== undefined,
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => executeStarted, 'transaction execution');
  runner.dispose();
  execution.resolve({ digest: 'digest-after-dispose' });

  await waitFor(() => outcomes.length === 1, 'dispose execute outcome');
  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-after-dispose',
    reason: 'Sign session disposed',
  });
});

test('execute rejection after start settles explicit uncertainty', async () => {
  const execution = createDeferred<{ digest: string }>();
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        const { digest } = await execution.promise;
        return executeSuccess(digest);
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => executeStarted, 'transaction execution');
  execution.reject(new Error('connection lost'));

  await waitFor(() => outcomes.length === 1, 'execute unknown outcome');
  assert.deepEqual(outcomes[0], {
    type: 'execute_result_unknown',
    bytes: '1,2,3',
    signature: 'signature-1',
    reason: 'Transaction execution result is unknown: connection lost',
  });
});

test('remote close during execute preserves submitted digest', async () => {
  const execution = createDeferred<{ digest: string }>();
  let executeStarted = false;
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        const { digest } = await execution.promise;
        return executeSuccess(digest);
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => executeStarted, 'transaction execution');
  transport.emitClose();
  execution.resolve({ digest: 'digest-after-remote-close' });

  await waitFor(() => outcomes.length === 1, 'remote close execute outcome');
  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-after-remote-close',
    reason: 'Connection closed before protocol delivery completed.',
  });
});

test('submitted ACK timeout preserves digest', async () => {
  const transport = new FakeTransport();
  const outcomes: unknown[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({ executeDigest: 'digest-ack-timeout' }),
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });

  await waitFor(() => outcomes.length === 1, 'submitted ack timeout outcome');
  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-ack-timeout',
    reason: 'Transaction was submitted, but delivery confirmation failed.',
  });
});

test('finality failure after submitted ACK sends structured terminal', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'sign.submitted.ack',
        payload: {
          digest: message.payload.digest,
          ackSequence: message.sequence,
        },
      });
    }
    if (message.type === 'protocol.error') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 4,
        type: 'protocol.error.ack',
        payload: {
          code: message.payload.code,
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({
      executeDigest: 'digest-finality-unknown',
      waitForTransaction: async () => {
        throw new Error('finality rpc timeout');
      },
    }),
    timeouts: { ackMs: 20, signResponseMs: 100, finalityMs: 5 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () =>
      transport.sent.some(
        (raw) => parseSent(raw, 'sign.transaction').type === 'sign.transaction',
      ),
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });

  await waitFor(() => outcomes.length === 1, 'finality unknown outcome');
  const terminal = transport.sent
    .map((raw) =>
      parseProtocolMessage(raw, {
        expectedSessionId: sessionId,
        expectedNetwork: network,
      }),
    )
    .find((message) => message.type === 'protocol.error');

  assert.equal(terminal?.payload.code, 'transaction_failed');
  assert.equal(terminal?.payload.details?.phase, 'finality');
  assert.equal(terminal?.payload.details?.digest, 'digest-finality-unknown');
  assert.deepEqual(outcomes[0], {
    type: 'submitted_finality_unknown',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-finality-unknown',
    reason:
      'Transaction was submitted, but finality was not confirmed: finality rpc timeout',
  });
});

test('accepts synchronous sign response during transaction delivery', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.transaction') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 2,
        type: 'sign.response',
        payload: { signature: 'signature-1' },
      });
    }
  });
  const outcomes: unknown[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({ executeDigest: 'digest-sync-response' }),
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });

  await waitFor(() => outcomes.length === 1, 'synchronous response outcome');
  assert.deepEqual(outcomes[0], {
    type: 'submitted_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-sync-response',
    reason: 'Transaction was submitted, but delivery confirmation failed.',
  });
});

test('state failure outcome preserves known chain facts', () => {
  const pending = { bytes: 'bytes-1', signerAddress };
  const reason = 'type_mismatch: Unexpected sign protocol message';

  assert.deepEqual(
    createSignHostFailureOutcome(
      {
        type: 'awaiting_submitted_ack',
        pending,
        signature: 'signature-1',
        digest: 'digest-submitted',
        chain: {
          type: 'digest_known',
          bytes: pending.bytes,
          signature: 'signature-1',
          digest: 'digest-submitted',
        },
        delivery: {
          type: 'submitted_ack_pending',
          digest: 'digest-submitted',
        },
        publicSettlement: { type: 'unresolved' },
      },
      reason,
    ),
    {
      type: 'submitted_delivery_failed',
      bytes: 'bytes-1',
      signature: 'signature-1',
      digest: 'digest-submitted',
      reason,
    },
  );

  assert.deepEqual(
    createSignHostFailureOutcome(
      {
        type: 'awaiting_finality',
        pending,
        signature: 'signature-1',
        digest: 'digest-submitted',
        chain: {
          type: 'digest_known',
          bytes: pending.bytes,
          signature: 'signature-1',
          digest: 'digest-submitted',
        },
        delivery: { type: 'open' },
        publicSettlement: { type: 'unresolved' },
      },
      reason,
    ),
    {
      type: 'submitted_finality_unknown',
      bytes: 'bytes-1',
      signature: 'signature-1',
      digest: 'digest-submitted',
      reason,
    },
  );

  assert.deepEqual(
    createSignHostFailureOutcome(
      {
        type: 'awaiting_finalized_ack',
        pending,
        signature: 'signature-1',
        digest: 'digest-finalized',
        effects: 'effects-1',
        chain: {
          type: 'finality_known',
          bytes: pending.bytes,
          signature: 'signature-1',
          digest: 'digest-finalized',
          effects: 'effects-1',
        },
        delivery: {
          type: 'finalized_ack_pending',
          digest: 'digest-finalized',
        },
        publicSettlement: { type: 'unresolved' },
      },
      reason,
    ),
    {
      type: 'finalized_delivery_failed',
      bytes: 'bytes-1',
      signature: 'signature-1',
      digest: 'digest-finalized',
      effects: 'effects-1',
      reason,
    },
  );
});

test('close during finality observation preserves finalized chain result', async () => {
  const finality = createDeferred<{ rawEffects: Uint8Array }>();
  let finalityStarted = false;
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'sign.submitted.ack',
        payload: {
          digest: message.payload.digest,
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () =>
        executeSuccess('digest-finality-after-close'),
      waitForTransaction: async () => {
        finalityStarted = true;
        const { rawEffects } = await finality.promise;
        return waitWithEffects(rawEffects);
      },
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 5, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () => findSent(transport, 'sign.transaction') !== undefined,
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => finalityStarted, 'finality observation');
  transport.emitClose();
  finality.resolve({ rawEffects: new Uint8Array([7, 7, 7]) });

  await waitFor(() => outcomes.length === 1, 'finality after close outcome');
  assert.deepEqual(outcomes[0], {
    type: 'finalized_delivery_failed',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-finality-after-close',
    effects: '7,7,7',
    reason: 'Connection closed before protocol delivery completed.',
  });
});

test('execute uncertainty is delivered as structured terminal when session is open', async () => {
  const execution = createDeferred<{ digest: string }>();
  let executeStarted = false;
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'protocol.error') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'protocol.error.ack',
        payload: {
          code: message.payload.code,
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => {
        executeStarted = true;
        const { digest } = await execution.promise;
        return executeSuccess(digest);
      },
      waitForTransaction: async () =>
        waitWithEffects(new Uint8Array([9, 9, 9])),
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 20, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () => findSent(transport, 'sign.transaction') !== undefined,
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => executeStarted, 'transaction execution');
  execution.reject(new Error('connection lost'));

  await waitFor(() => outcomes.length === 1, 'execute unknown outcome');
  const terminal = findSent(transport, 'protocol.error');
  assert.equal(terminal?.payload.code, 'transaction_failed');
  assert.equal(terminal?.payload.details?.phase, 'execute');
  assert.deepEqual(outcomes[0], {
    type: 'execute_result_unknown',
    bytes: '1,2,3',
    signature: 'signature-1',
    reason: 'Transaction execution result is unknown: connection lost',
  });
});

test('sign host rejects every unexpected pre-submit message without going silent', async () => {
  const matrix = [
    {
      state: 'awaiting_address',
      expectedType: 'sign.address',
      inboundSequence: 1,
      setup: async () => {},
    },
    {
      state: 'awaiting_signature',
      expectedType: 'sign.response',
      inboundSequence: 2,
      setup: async (transport: FakeTransport) => {
        emitHostInbound({
          transport,
          sequence: 1,
          type: 'sign.address',
          payload: { address: signerAddress },
        });
        await waitFor(
          () => findSent(transport, 'sign.transaction') !== undefined,
          'sign.transaction',
        );
      },
    },
  ] as const;

  for (const { state, expectedType, inboundSequence, setup } of matrix) {
    for (const type of protocolMessageTypes) {
      if (type === expectedType || type === 'protocol.error') continue;

      const transport = new FakeTransport((raw, currentTransport) => {
        const message = parseProtocolMessage(raw, {
          expectedSessionId: sessionId,
          expectedNetwork: network,
        });
        if (message.type === 'protocol.error') {
          emitHostInbound({
            transport: currentTransport,
            sequence: inboundSequence + 1,
            type: 'protocol.error.ack',
            payload: {
              code: message.payload.code,
              ackSequence: message.sequence,
            },
          });
        }
      });
      const outcomes: unknown[] = [];

      startSignHostRunner({
        sessionId,
        network,
        transport,
        transaction: { toJSON: async () => '{}' },
        onEvent: () => {},
        onFinish: (outcome) => outcomes.push(outcome),
        deps: createDeps(),
        timeouts: { ackMs: 20, signResponseMs: 100, finalityMs: 100 },
      });

      await setup(transport);
      emitHostInbound({
        transport,
        sequence: inboundSequence,
        type,
        payload: payloadFor(type),
      });

      await waitFor(
        () => outcomes.length === 1,
        `sign host ${state} unexpected ${type}`,
      );
      assert.deepEqual(
        outcomes[0],
        {
          type: 'failed_before_submit',
          reason: 'type_mismatch: Unexpected sign protocol message',
        },
        `${state}:${type}`,
      );
      assert.equal(findSent(transport, 'protocol.error')?.payload.code, 'type_mismatch');
    }
  }
});

test('sign host preserves submitted digest when submitted ACK is invalid', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'sign.submitted.ack',
        payload: {
          digest: 'wrong-digest',
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: QRSignOutcome[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({ executeDigest: 'digest-invalid-submitted-ack' }),
    timeouts: { ackMs: 100, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () => findSent(transport, 'sign.transaction') !== undefined,
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });

  await waitFor(() => outcomes.length === 1, 'invalid submitted ack outcome');
  assert.equal(outcomes[0].type, 'submitted_delivery_failed');
  assert.equal(outcomes[0].bytes, '1,2,3');
  assert.equal(outcomes[0].signature, 'signature-1');
  assert.equal(outcomes[0].digest, 'digest-invalid-submitted-ack');
  assert.match(outcomes[0].reason, /Invalid sign protocol message/);
});

test('sign host preserves finalized effects when finalized ACK is invalid', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'sign.submitted.ack',
        payload: {
          digest: message.payload.digest,
          ackSequence: message.sequence,
        },
      });
    }
    if (message.type === 'sign.finalized') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 4,
        type: 'sign.finalized.ack',
        payload: {
          digest: 'wrong-digest',
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: QRSignOutcome[] = [];

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps: createDeps({ executeDigest: 'digest-invalid-finalized-ack' }),
    timeouts: { ackMs: 100, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () => findSent(transport, 'sign.transaction') !== undefined,
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });

  await waitFor(() => outcomes.length === 1, 'invalid finalized ack outcome');
  assert.equal(outcomes[0].type, 'finalized_delivery_failed');
  assert.equal(outcomes[0].bytes, '1,2,3');
  assert.equal(outcomes[0].signature, 'signature-1');
  assert.equal(outcomes[0].digest, 'digest-invalid-finalized-ack');
  assert.equal(outcomes[0].effects, '9,9,9');
  assert.match(outcomes[0].reason, /Invalid sign protocol message/);
});

test('sign host finality observation drops queued app messages without downgrading outcome', async () => {
  const finality = createDeferred<{ rawEffects: Uint8Array }>();
  let finalityStarted = false;
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.submitted') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 3,
        type: 'sign.submitted.ack',
        payload: {
          digest: message.payload.digest,
          ackSequence: message.sequence,
        },
      });
    }
    if (message.type === 'sign.finalized') {
      emitHostInbound({
        transport: currentTransport,
        sequence: 5,
        type: 'sign.finalized.ack',
        payload: {
          digest: message.payload.digest,
          ackSequence: message.sequence,
        },
      });
    }
  });
  const outcomes: unknown[] = [];
  const deps = createDeps();
  deps.createClient = () =>
    fakeCoreClient({
      executeTransaction: async () => executeSuccess('digest-finalized'),
      waitForTransaction: async () => {
        finalityStarted = true;
        const { rawEffects } = await finality.promise;
        return waitWithEffects(rawEffects);
      },
    });

  startSignHostRunner({
    sessionId,
    network,
    transport,
    transaction: { toJSON: async () => '{}' },
    onEvent: () => {},
    onFinish: (outcome) => outcomes.push(outcome),
    deps,
    timeouts: { ackMs: 100, signResponseMs: 100, finalityMs: 100 },
  });

  emitHostInbound({
    transport,
    sequence: 1,
    type: 'sign.address',
    payload: { address: signerAddress },
  });
  await waitFor(
    () => findSent(transport, 'sign.transaction') !== undefined,
    'sign.transaction',
  );

  emitHostInbound({
    transport,
    sequence: 2,
    type: 'sign.response',
    payload: { signature: 'signature-1' },
  });
  await waitFor(() => finalityStarted, 'finality observation');

  emitHostInbound({
    transport,
    sequence: 4,
    type: 'sign.response',
    payload: { signature: 'late-signature' },
  });
  finality.resolve({ rawEffects: new Uint8Array([8, 8, 8]) });

  await waitFor(() => outcomes.length === 1, 'queued app final outcome');
  assert.deepEqual(outcomes[0], {
    type: 'signed_and_finalized',
    bytes: '1,2,3',
    signature: 'signature-1',
    digest: 'digest-finalized',
    effects: '8,8,8',
  });
});
