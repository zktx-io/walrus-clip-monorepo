import assert from 'node:assert/strict';
import test from 'node:test';

import { createJiti } from 'jiti';

import {
  createProtocolMessage,
  parseProtocolMessage,
  type ProtocolEnvelope,
  type ProtocolMessageType,
} from '../../walrus-connect-route-internal/src/utils/message.ts';
import type { ProtocolTransport } from '../../walrus-connect-route-internal/src/protocol/session.ts';
import type { SignScannerRunnerDeps } from '../../walrus-connect-route-internal/src/protocol/signScannerRunner.ts';

const jiti = createJiti(import.meta.url);
const { startSignScannerRunner } = await jiti.import<{
  startSignScannerRunner: typeof import('../../walrus-connect-route-internal/src/protocol/signScannerRunner.ts').startSignScannerRunner;
}>('../../walrus-connect-route-internal/src/protocol/signScannerRunner.ts');

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
  'sign.personalMessage',
  'sign.personalMessage.response',
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
      return {
        bytes: 'bytes-1',
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.response':
      return { signature: 'signature-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.personalMessage':
      return { bytes: 'message-1' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.personalMessage.response':
      return {
        bytes: 'message-1',
        signature: 'signature-1',
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.submitted':
      return { digest: 'digest-submitted' } as ProtocolEnvelope<TType>['payload'];
    case 'sign.submitted.ack':
      return {
        digest: 'digest-submitted',
        ackSequence: 1,
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.finalized':
      return {
        digest: 'digest-submitted',
        effects: 'effects-1',
      } as ProtocolEnvelope<TType>['payload'];
    case 'sign.finalized.ack':
      return {
        digest: 'digest-submitted',
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

const emitScannerInbound = <TType extends ProtocolMessageType>({
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

const createHappyDeps = (): Partial<SignScannerRunnerDeps> => ({
  createClient: () =>
    ({
      waitForTransaction: async () => ({ rawEffects: new Uint8Array([1]) }),
    }) as never,
  decodeBytes: () => new Uint8Array([1, 2, 3]),
  encodeBytes: () => 'effects-1',
  createTransactionFromBytes: () => ({}) as never,
  getTransactionSenderValidationError: () => undefined,
  createSignTransactionReview: async () => ({
    ok: true,
    review: {
      network,
      sender: signerAddress,
      sponsored: false,
      gas: { owner: signerAddress, budget: '1', price: '1', payments: [] },
      inputs: [],
      commands: [],
      dryRun: {
        status: 'success',
        balanceChanges: [],
        objectChanges: [],
        events: [],
      },
      warnings: [],
    },
  }),
  approveSignTransactionReview: async () => ({ ok: true }),
  validateSubmittedDigest: async () => ({
    ok: true,
    digest: 'digest-submitted',
  }),
  validateFinalizedDigest: () => ({ ok: true }),
});

const createHappySigner = () =>
  ({
    getAddress: () => signerAddress,
    reviewTransaction: async () => true,
    signPersonalMessage: async () => ({
      bytes: 'message-1',
      signature: 'message-signature-1',
    }),
    signTransaction: async () => ({
      bytes: 'bytes-1',
      signature: 'signature-1',
    }),
  }) as never;

const startScannerAt = async (
  state: 'awaiting_transaction' | 'awaiting_submitted' | 'awaiting_finalized',
  transport: FakeTransport,
  events: Array<{ variant: string; message: string }>,
) => {
  const runner = startSignScannerRunner({
    signer: createHappySigner(),
    network,
    sessionId,
    transport,
    onEvent: (event) => events.push(event),
    deps: createHappyDeps(),
    timeouts: {
      proposalMs: 100,
      submissionMs: 100,
      finalityMs: 100,
      ackMs: 20,
      closeFallbackMs: 5,
    },
  });

  await waitFor(
    () => findSent(transport, 'sign.address') !== undefined,
    'sign.address',
  );
  if (state === 'awaiting_transaction') return runner;

  emitScannerInbound({
    transport,
    sequence: 1,
    type: 'sign.transaction',
    payload: payloadFor('sign.transaction'),
  });
  await waitFor(
    () => findSent(transport, 'sign.response') !== undefined,
    'sign.response',
  );
  if (state === 'awaiting_submitted') return runner;

  emitScannerInbound({
    transport,
    sequence: 2,
    type: 'sign.submitted',
    payload: payloadFor('sign.submitted'),
  });
  await waitFor(
    () => findSent(transport, 'sign.submitted.ack') !== undefined,
    'sign.submitted.ack',
  );

  return runner;
};

test('scanner settles a sign-only transaction request after sending the signature', async () => {
  const transport = new FakeTransport();
  const events: Array<{ variant: string; message: string }> = [];
  const runner = startSignScannerRunner({
    signer: createHappySigner(),
    network,
    sessionId,
    transport,
    onEvent: (event) => events.push(event),
    deps: createHappyDeps(),
    timeouts: {
      proposalMs: 100,
      submissionMs: 100,
      finalityMs: 100,
      ackMs: 20,
      closeFallbackMs: 5,
    },
  });

  await waitFor(
    () => findSent(transport, 'sign.address') !== undefined,
    'sign.address',
  );
  emitScannerInbound({
    transport,
    sequence: 1,
    type: 'sign.transaction',
    payload: { ...payloadFor('sign.transaction'), intent: 'sign' },
  });
  await waitFor(
    () => findSent(transport, 'sign.response') !== undefined,
    'sign.response',
  );

  assert.equal(findSent(transport, 'sign.response')?.payload.signature, 'signature-1');
  assert.deepEqual(events.at(-1), {
    variant: 'success',
    message: 'Transaction signed',
  });
  runner.dispose();
});

test('scanner signs personal-message requests without transaction review', async () => {
  let reviewCalled = false;
  const transport = new FakeTransport();
  const events: Array<{ variant: string; message: string }> = [];
  const runner = startSignScannerRunner({
    signer: createHappySigner(),
    network,
    sessionId,
    transport,
    onEvent: (event) => events.push(event),
    deps: {
      ...createHappyDeps(),
      approveSignTransactionReview: async () => {
        reviewCalled = true;
        return { ok: true };
      },
    },
    timeouts: {
      proposalMs: 100,
      submissionMs: 100,
      finalityMs: 100,
      ackMs: 20,
      closeFallbackMs: 5,
    },
  });

  await waitFor(
    () => findSent(transport, 'sign.address') !== undefined,
    'sign.address',
  );
  emitScannerInbound({
    transport,
    sequence: 1,
    type: 'sign.personalMessage',
    payload: { bytes: 'message-1' },
  });
  await waitFor(
    () => findSent(transport, 'sign.personalMessage.response') !== undefined,
    'sign.personalMessage.response',
  );

  assert.equal(reviewCalled, false);
  assert.deepEqual(findSent(transport, 'sign.personalMessage.response')?.payload, {
    bytes: 'message-1',
    signature: 'message-signature-1',
  });
  assert.deepEqual(events.at(-1), {
    variant: 'success',
    message: 'Personal message signed',
  });
  runner.dispose();
});

test('terminal ack remains allowed after remote sign scanner protocol error', async () => {
  const transport = new FakeTransport();
  const runner = startSignScannerRunner({
    signer: {
      getAddress: () => signerAddress,
    } as never,
    network,
    sessionId,
    transport,
    onEvent: () => {},
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 1,
      type: 'protocol.error',
      payload: {
        code: 'transaction_rejected',
        message: 'remote rejected',
      },
    }),
  );

  await waitFor(
    () => findSent(transport, 'protocol.error.ack') !== undefined,
    'protocol.error.ack',
  );

  const ack = findSent(transport, 'protocol.error.ack');
  assert.equal(ack?.payload.code, 'transaction_rejected');
  assert.equal(ack?.payload.ackSequence, 1);
  runner.dispose();
});

test('structured finality terminal from host closes scanner without timeout fallback', async () => {
  const transport = new FakeTransport();
  const events: Array<{ variant: string; message: string }> = [];
  const deps: Partial<SignScannerRunnerDeps> = {
    createClient: () =>
      ({
        waitForTransaction: async () => ({ rawEffects: new Uint8Array([1]) }),
      }) as never,
    decodeBytes: () => new Uint8Array([1, 2, 3]),
    createTransactionFromBytes: () => ({}) as never,
    getTransactionSenderValidationError: () => undefined,
    createSignTransactionReview: async () => ({
      ok: true,
      review: {
        network,
        sender: signerAddress,
        sponsored: false,
        gas: { owner: signerAddress, budget: '1', price: '1', payments: [] },
        inputs: [],
        commands: [],
        dryRun: {
          status: 'success',
          balanceChanges: [],
          objectChanges: [],
          events: [],
        },
        warnings: [],
      },
    }),
    approveSignTransactionReview: async () => ({ ok: true }),
    validateSubmittedDigest: async () => ({
      ok: true,
      digest: 'digest-submitted',
    }),
  };

  startSignScannerRunner({
    signer: {
      getAddress: () => signerAddress,
      reviewTransaction: async () => true,
      signTransaction: async () => ({
        bytes: 'bytes-1',
        signature: 'signature-1',
      }),
    } as never,
    network,
    sessionId,
    transport,
    onEvent: (event) => events.push(event),
    deps,
    timeouts: {
      proposalMs: 100,
      submissionMs: 100,
      finalityMs: 100,
      ackMs: 20,
      closeFallbackMs: 5,
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 1,
      type: 'sign.transaction',
      payload: {
        bytes: 'bytes-1',
      },
    }),
  );
  await waitFor(
    () => findSent(transport, 'sign.response') !== undefined,
    'sign.response',
  );

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 2,
      type: 'sign.submitted',
      payload: { digest: 'digest-submitted' },
    }),
  );
  await waitFor(
    () => findSent(transport, 'sign.submitted.ack') !== undefined,
    'sign.submitted.ack',
  );

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 3,
      type: 'protocol.error',
      payload: {
        code: 'transaction_failed',
        message:
          'Transaction was submitted, but finality was not confirmed: timeout',
        details: {
          phase: 'finality',
          digest: 'digest-submitted',
        },
      },
    }),
  );

  await waitFor(
    () => findSent(transport, 'protocol.error.ack') !== undefined,
    'protocol.error.ack',
  );

  const ack = findSent(transport, 'protocol.error.ack');
  assert.equal(ack?.payload.code, 'transaction_failed');
  assert.equal(ack?.payload.ackSequence, 3);
  assert.deepEqual(events.at(-1), {
    variant: 'error',
    message:
      'transaction_failed: Transaction was submitted, but finality was not confirmed: timeout',
  });
});

test('accepts synchronous submitted message during sign response delivery', async () => {
  const transport = new FakeTransport((raw, currentTransport) => {
    const message = parseProtocolMessage(raw, {
      expectedSessionId: sessionId,
      expectedNetwork: network,
    });
    if (message.type === 'sign.response') {
      currentTransport.emitMessage(
        createProtocolMessage({
          sessionId,
          network,
          sequence: 2,
          type: 'sign.submitted',
          payload: { digest: 'digest-submitted' },
        }),
      );
    }
  });
  const deps: Partial<SignScannerRunnerDeps> = {
    createClient: () =>
      ({
        waitForTransaction: async () => ({ rawEffects: new Uint8Array([1]) }),
      }) as never,
    decodeBytes: () => new Uint8Array([1, 2, 3]),
    createTransactionFromBytes: () => ({}) as never,
    getTransactionSenderValidationError: () => undefined,
    createSignTransactionReview: async () => ({
      ok: true,
      review: {
        network,
        sender: signerAddress,
        sponsored: false,
        gas: { owner: signerAddress, budget: '1', price: '1', payments: [] },
        inputs: [],
        commands: [],
        dryRun: {
          status: 'success',
          balanceChanges: [],
          objectChanges: [],
          events: [],
        },
        warnings: [],
      },
    }),
    approveSignTransactionReview: async () => ({ ok: true }),
    validateSubmittedDigest: async () => ({
      ok: true,
      digest: 'digest-submitted',
    }),
  };

  startSignScannerRunner({
    signer: {
      getAddress: () => signerAddress,
      reviewTransaction: async () => true,
      signTransaction: async () => ({
        bytes: 'bytes-1',
        signature: 'signature-1',
      }),
    } as never,
    network,
    sessionId,
    transport,
    onEvent: () => {},
    deps,
    timeouts: {
      proposalMs: 100,
      submissionMs: 100,
      finalityMs: 100,
      ackMs: 20,
      closeFallbackMs: 5,
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 1,
      type: 'sign.transaction',
      payload: {
        bytes: 'bytes-1',
      },
    }),
  );

  await waitFor(
    () => findSent(transport, 'sign.submitted.ack') !== undefined,
    'sign.submitted.ack',
  );

  const ack = findSent(transport, 'sign.submitted.ack');
  assert.equal(ack?.payload.digest, 'digest-submitted');
  assert.equal(ack?.payload.ackSequence, 2);
});

test('scanner preserves host execute unknown structured terminal', async () => {
  const transport = new FakeTransport();
  const events: Array<{ variant: string; message: string }> = [];
  const deps: Partial<SignScannerRunnerDeps> = {
    createClient: () =>
      ({
        waitForTransaction: async () => ({ rawEffects: new Uint8Array([1]) }),
      }) as never,
    decodeBytes: () => new Uint8Array([1, 2, 3]),
    createTransactionFromBytes: () => ({}) as never,
    getTransactionSenderValidationError: () => undefined,
    createSignTransactionReview: async () => ({
      ok: true,
      review: {
        network,
        sender: signerAddress,
        sponsored: false,
        gas: { owner: signerAddress, budget: '1', price: '1', payments: [] },
        inputs: [],
        commands: [],
        dryRun: {
          status: 'success',
          balanceChanges: [],
          objectChanges: [],
          events: [],
        },
        warnings: [],
      },
    }),
    approveSignTransactionReview: async () => ({ ok: true }),
    validateSubmittedDigest: async () => ({
      ok: true,
      digest: 'digest-submitted',
    }),
  };

  startSignScannerRunner({
    signer: {
      getAddress: () => signerAddress,
      reviewTransaction: async () => true,
      signTransaction: async () => ({
        bytes: 'bytes-1',
        signature: 'signature-1',
      }),
    } as never,
    network,
    sessionId,
    transport,
    onEvent: (event) => events.push(event),
    deps,
    timeouts: {
      proposalMs: 100,
      submissionMs: 100,
      finalityMs: 100,
      ackMs: 20,
      closeFallbackMs: 5,
    },
  });

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 1,
      type: 'sign.transaction',
      payload: {
        bytes: 'bytes-1',
      },
    }),
  );
  await waitFor(
    () => findSent(transport, 'sign.response') !== undefined,
    'sign.response',
  );

  transport.emitMessage(
    createProtocolMessage({
      sessionId,
      network,
      sequence: 2,
      type: 'protocol.error',
      payload: {
        code: 'transaction_failed',
        message: 'Transaction execution result is unknown: connection lost',
        details: {
          phase: 'execute',
        },
      },
    }),
  );

  await waitFor(
    () => findSent(transport, 'protocol.error.ack') !== undefined,
    'protocol.error.ack',
  );

  const ack = findSent(transport, 'protocol.error.ack');
  assert.equal(ack?.payload.code, 'transaction_failed');
  assert.equal(ack?.payload.ackSequence, 2);
  assert.deepEqual(events.at(-1), {
    variant: 'error',
    message:
      'transaction_failed: Transaction execution result is unknown: connection lost',
  });
});

test('sign scanner rejects every unexpected message in stable states without going silent', async () => {
  const matrix = [
    {
      state: 'awaiting_transaction',
      expectedTypes: ['sign.transaction', 'sign.personalMessage'],
      inboundSequence: 1,
    },
    {
      state: 'awaiting_submitted',
      expectedTypes: ['sign.submitted'],
      inboundSequence: 2,
    },
    {
      state: 'awaiting_finalized',
      expectedTypes: ['sign.finalized'],
      inboundSequence: 3,
    },
  ] as const;

  for (const { state, expectedTypes, inboundSequence } of matrix) {
    for (const type of protocolMessageTypes) {
      if (
        expectedTypes.includes(
          type as (typeof expectedTypes)[number],
        ) ||
        type === 'protocol.error'
      ) {
        continue;
      }

      const transport = new FakeTransport();
      const events: Array<{ variant: string; message: string }> = [];
      const runner = await startScannerAt(state, transport, events);

      emitScannerInbound({
        transport,
        sequence: inboundSequence,
        type,
        payload: payloadFor(type),
      });

      await waitFor(
        () => findSent(transport, 'protocol.error') !== undefined,
        `sign scanner ${state} unexpected ${type}`,
      );
      assert.equal(
        findSent(transport, 'protocol.error')?.payload.code,
        'type_mismatch',
        `${state}:${type}`,
      );
      assert.deepEqual(
        events.at(-1),
        {
          variant: 'error',
          message: 'type_mismatch: Unexpected sign protocol message',
        },
        `${state}:${type}`,
      );
      runner.dispose();
    }
  }
});
