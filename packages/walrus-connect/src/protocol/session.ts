import type { NETWORK } from '../types';
import type {
  ProtocolEnvelope,
  ProtocolMessageType,
  ProtocolPayloadByType,
} from '../utils/message';

export type ProtocolTransport = {
  send: (raw: string) => void;
  close: (reason?: string) => void;
  isOpen: () => boolean;
  onMessage: (handler: (raw: unknown) => void) => () => void;
  onClose: (handler: () => void) => () => void;
  onError: (handler: (error: Error) => void) => () => void;
};

export type ProtocolCodec = {
  createMessage: <TType extends ProtocolMessageType>(params: {
    sessionId: string;
    network: NETWORK;
    sequence: number;
    type: TType;
    payload: ProtocolPayloadByType[TType];
    expiresAt?: number;
    ttlMs?: number;
    now?: number;
  }) => string;
  parseMessage: <TExpected extends ProtocolMessageType = ProtocolMessageType>(
    raw: unknown,
    options: {
      expectedSessionId: string;
      expectedNetwork: NETWORK;
      expectedType?: TExpected | readonly TExpected[];
      now?: number;
    },
  ) => ProtocolEnvelope<TExpected>;
};

export type ProtocolSessionTerminalReason =
  | 'local_closed'
  | 'remote_closed'
  | 'transport_error'
  | 'ack_timeout'
  | 'protocol_error'
  | 'success';

export class ProtocolSessionClosedError extends Error {
  readonly reason: ProtocolSessionTerminalReason;

  constructor(reason: ProtocolSessionTerminalReason, message?: string) {
    super(message ?? `Protocol session is closed: ${reason}`);
    this.name = 'ProtocolSessionClosedError';
    this.reason = reason;
  }
}

export class ProtocolSequenceError extends Error {
  readonly sequence: number;
  readonly lastInboundSequence: number;

  constructor(sequence: number, lastInboundSequence: number) {
    super('Protocol message sequence is duplicate or late');
    this.name = 'ProtocolSequenceError';
    this.sequence = sequence;
    this.lastInboundSequence = lastInboundSequence;
  }
}

type PendingAck = {
  ackSequence: number;
  expectedType: ProtocolMessageType;
  resolve: (message: ProtocolEnvelope) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  validate?: (message: ProtocolEnvelope) => boolean;
};

type TerminalAckPermission = {
  receivedSequence: number;
  ackType: ProtocolMessageType;
};

type ProtocolSessionState =
  | { kind: 'open' }
  | {
      kind: 'closing';
      reason: ProtocolSessionTerminalReason;
      allowedTerminalAck?: TerminalAckPermission;
    }
  | { kind: 'closed'; reason: ProtocolSessionTerminalReason };

export type ProtocolSessionOptions = {
  sessionId: string;
  network: NETWORK;
  transport: ProtocolTransport;
  codec: ProtocolCodec;
  onMessage?: (message: ProtocolEnvelope) => void | Promise<void>;
  onClose?: (reason: ProtocolSessionTerminalReason) => void;
  onError?: (error: Error) => void;
};

export type SendAndWaitForAckParams<
  TType extends ProtocolMessageType,
  TAckType extends ProtocolMessageType,
> = {
  type: TType;
  payload: ProtocolPayloadByType[TType];
  expectedAckType: TAckType;
  timeoutMs: number;
  closeOnAck?: boolean;
  validateAck?: (message: ProtocolEnvelope<TAckType>) => boolean;
};

export class ProtocolSession {
  readonly #sessionId: string;
  readonly #network: NETWORK;
  readonly #transport: ProtocolTransport;
  readonly #codec: ProtocolCodec;
  readonly #pendingAcks = new Map<number, PendingAck>();
  readonly #disposers: Array<() => void> = [];
  readonly #appMessageQueue: ProtocolEnvelope[] = [];
  #nextOutboundSequence = 1;
  #lastInboundSequence = 0;
  #state: ProtocolSessionState = { kind: 'open' };
  #isProcessingAppQueue = false;
  #onMessage?: (message: ProtocolEnvelope) => void | Promise<void>;
  #onClose?: (reason: ProtocolSessionTerminalReason) => void;
  #onError?: (error: Error) => void;

  constructor({
    sessionId,
    network,
    transport,
    codec,
    onMessage,
    onClose,
    onError,
  }: ProtocolSessionOptions) {
    this.#sessionId = sessionId;
    this.#network = network;
    this.#transport = transport;
    this.#codec = codec;
    this.#onMessage = onMessage;
    this.#onClose = onClose;
    this.#onError = onError;

    this.#disposers.push(
      transport.onMessage((raw) => {
        void this.#handleRawMessage(raw);
      }),
      transport.onClose(() => {
        this.markTerminal('remote_closed');
      }),
      transport.onError((error) => {
        this.#emitError(error);
        this.markTerminal('transport_error');
      }),
    );
  }

  get terminalReason() {
    return this.#state.kind === 'open' ? undefined : this.#state.reason;
  }

  get lastInboundSequence() {
    return this.#lastInboundSequence;
  }

  isActive() {
    return this.#state.kind === 'open' && this.#transport.isOpen();
  }

  assertActive() {
    if (!this.isActive()) {
      throw new ProtocolSessionClosedError(this.#closedReason());
    }
  }

  setMessageHandler(
    handler: (message: ProtocolEnvelope) => void | Promise<void>,
  ) {
    this.#onMessage = handler;
  }

  send<TType extends ProtocolMessageType>(
    type: TType,
    payload: ProtocolPayloadByType[TType],
  ): ProtocolEnvelope<TType> {
    this.assertActive();

    const { raw, message } = this.#createOutboundMessage(type, payload);
    this.#transport.send(raw);

    return message;
  }

  sendAck<TType extends ProtocolMessageType>(
    received: ProtocolEnvelope,
    type: TType,
    payload: ProtocolPayloadByType[TType],
  ): ProtocolEnvelope<TType> {
    if (
      typeof (payload as { ackSequence?: unknown }).ackSequence === 'number' &&
      (payload as { ackSequence: number }).ackSequence !== received.sequence
    ) {
      throw new ProtocolSequenceError(
        (payload as { ackSequence: number }).ackSequence,
        received.sequence,
      );
    }

    if (this.#state.kind !== 'open') {
      if (!this.#canSendTerminalAck(received, type)) {
        throw new ProtocolSessionClosedError(this.#closedReason());
      }
      if (!this.#transport.isOpen()) {
        throw new ProtocolSessionClosedError('remote_closed');
      }
      const { raw, message } = this.#createOutboundMessage(type, payload);
      this.#transport.send(raw);
      if (this.#state.kind === 'closing') {
        this.#state = {
          kind: 'closing',
          reason: this.#state.reason,
        };
      }
      return message;
    }

    return this.send(type, payload);
  }

  async sendAndWaitForAck<
    TType extends ProtocolMessageType,
    TAckType extends ProtocolMessageType,
  >({
    type,
    payload,
    expectedAckType,
    timeoutMs,
    closeOnAck = false,
    validateAck,
  }: SendAndWaitForAckParams<TType, TAckType>): Promise<{
    message: ProtocolEnvelope<TType>;
    ack: ProtocolEnvelope<TAckType>;
  }> {
    this.assertActive();
    const { raw, message } = this.#createOutboundMessage(type, payload);

    const ack = await new Promise<ProtocolEnvelope<TAckType>>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.#pendingAcks.delete(message.sequence);
          const error = new ProtocolSessionClosedError(
            'ack_timeout',
            `Timed out waiting for ${expectedAckType}`,
          );
          this.markTerminal('ack_timeout');
          this.#transport.close('ack_timeout');
          reject(error);
        }, timeoutMs);

        this.#pendingAcks.set(message.sequence, {
          ackSequence: message.sequence,
          expectedType: expectedAckType,
          resolve: (ackMessage) =>
            resolve(ackMessage as ProtocolEnvelope<TAckType>),
          reject,
          timer,
          validate: validateAck as
            | ((ackMessage: ProtocolEnvelope) => boolean)
            | undefined,
        });

        if (closeOnAck) {
          this.#enterClosing('success', undefined, message.sequence);
        }

        try {
          this.#transport.send(raw);
        } catch (error) {
          clearTimeout(timer);
          this.#pendingAcks.delete(message.sequence);
          if (closeOnAck) {
            this.markTerminal('transport_error');
            this.#transport.close('transport_error');
          }
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );

    if (closeOnAck) {
      this.markTerminal('success');
      this.#transport.close();
    }

    return { message, ack };
  }

  markTerminal(reason: ProtocolSessionTerminalReason) {
    if (this.#state.kind === 'closed') return;

    this.#state = { kind: 'closed', reason };
    this.#rejectPendingAcks(reason);
    this.#appMessageQueue.length = 0;
    this.#disposeTransportListeners();
    this.#onClose?.(reason);
  }

  close(reason: ProtocolSessionTerminalReason = 'local_closed') {
    this.markTerminal(reason);
    this.#transport.close(reason);
  }

  dispose() {
    this.markTerminal('local_closed');
  }

  async #handleRawMessage(raw: unknown) {
    if (this.#state.kind === 'closed') return;

    try {
      const message = this.#codec.parseMessage(raw, {
        expectedSessionId: this.#sessionId,
        expectedNetwork: this.#network,
      });
      this.#validateInboundSequence(message.sequence);

      const ackSequence = (message.payload as { ackSequence?: unknown })
        .ackSequence;
      if (typeof ackSequence === 'number') {
        const pending = this.#pendingAcks.get(ackSequence);
        if (pending) {
          if (message.type !== pending.expectedType) {
            throw new ProtocolSequenceError(
              message.sequence,
              this.#lastInboundSequence,
            );
          }
          if (pending.validate && !pending.validate(message)) {
            throw new ProtocolSequenceError(
              message.sequence,
              this.#lastInboundSequence,
            );
          }

          clearTimeout(pending.timer);
          this.#pendingAcks.delete(ackSequence);
          pending.resolve(message);
          return;
        }
      }

      if (message.type === 'protocol.error') {
        this.#deliverTerminalControlMessage(message);
        return;
      }

      if (this.#state.kind !== 'open') return;

      this.#appMessageQueue.push(message);
      this.#processAppMessageQueue();
    } catch (error) {
      this.#emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  #deliverTerminalControlMessage(message: ProtocolEnvelope<'protocol.error'>) {
    if (this.#state.kind === 'closed') return;

    this.#state = {
      kind: 'closing',
      reason: 'protocol_error',
      allowedTerminalAck: {
        receivedSequence: message.sequence,
        ackType: 'protocol.error.ack',
      },
    };
    this.#rejectPendingAcks('protocol_error');
    this.#appMessageQueue.length = 0;
    void (async () => {
      try {
        await this.#onMessage?.(message);
      } catch (error) {
        this.#emitError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    })();
  }

  #processAppMessageQueue() {
    if (this.#isProcessingAppQueue) return;

    this.#isProcessingAppQueue = true;
    void (async () => {
      try {
        while (this.#state.kind === 'open') {
          const message = this.#appMessageQueue.shift();
          if (!message) break;

          try {
            await this.#onMessage?.(message);
          } catch (error) {
            this.#emitError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }
      } finally {
        this.#isProcessingAppQueue = false;
        if (this.#state.kind !== 'open') {
          this.#appMessageQueue.length = 0;
          return;
        }
        if (this.#appMessageQueue.length > 0) {
          this.#processAppMessageQueue();
        }
      }
    })();
  }

  #validateInboundSequence(sequence: number) {
    if (sequence <= this.#lastInboundSequence) {
      throw new ProtocolSequenceError(sequence, this.#lastInboundSequence);
    }
    this.#lastInboundSequence = sequence;
  }

  #emitError(error: Error) {
    this.#onError?.(error);
  }

  #closedReason(): ProtocolSessionTerminalReason {
    if (this.#state.kind !== 'open') return this.#state.reason;
    return this.#transport.isOpen() ? 'local_closed' : 'remote_closed';
  }

  #canSendTerminalAck(
    received: ProtocolEnvelope,
    type: ProtocolMessageType,
  ) {
    if (this.#state.kind !== 'closing') return false;

    return (
      this.#state.allowedTerminalAck?.receivedSequence === received.sequence &&
      this.#state.allowedTerminalAck.ackType === type
    );
  }

  #enterClosing(
    reason: ProtocolSessionTerminalReason,
    allowedTerminalAck?: TerminalAckPermission,
    keepPendingAckSequence?: number,
  ) {
    if (this.#state.kind !== 'open') return;

    this.#state = {
      kind: 'closing',
      reason,
      allowedTerminalAck,
    };
    this.#rejectPendingAcks(reason, keepPendingAckSequence);
    this.#appMessageQueue.length = 0;
  }

  #rejectPendingAcks(
    reason: ProtocolSessionTerminalReason,
    keepPendingAckSequence?: number,
  ) {
    for (const [sequence, pending] of this.#pendingAcks) {
      if (sequence === keepPendingAckSequence) continue;

      clearTimeout(pending.timer);
      pending.reject(new ProtocolSessionClosedError(reason));
      this.#pendingAcks.delete(sequence);
    }
  }

  #createOutboundMessage<TType extends ProtocolMessageType>(
    type: TType,
    payload: ProtocolPayloadByType[TType],
  ): { raw: string; message: ProtocolEnvelope<TType> } {
    const sequence = this.#nextOutboundSequence++;
    const raw = this.#codec.createMessage({
      sessionId: this.#sessionId,
      network: this.#network,
      sequence,
      type,
      payload,
    });
    const message = this.#codec.parseMessage(raw, {
      expectedSessionId: this.#sessionId,
      expectedNetwork: this.#network,
      expectedType: type,
    });

    return { raw, message };
  }

  #disposeTransportListeners() {
    for (const dispose of this.#disposers.splice(0)) {
      dispose();
    }
  }
}
