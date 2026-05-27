import type { ProtocolSession, SendAndWaitForAckParams } from './session';
import type {
  ProtocolEnvelope,
  ProtocolMessageType,
  ProtocolPayloadByType,
} from '../utils/message';

export type EffectAuthorityTerminalReason =
  | 'completed'
  | 'cancelled'
  | 'local_closed'
  | 'remote_closed'
  | 'transport_error'
  | 'ack_timeout'
  | 'protocol_error'
  | 'success';

export type EffectKind =
  | 'cancellable'
  | 'external_pre_submit'
  | 'irreversible_execute'
  | 'post_submit_observation'
  | 'protocol_delivery'
  | 'terminal_ack';

export class EffectAuthorityTerminatedError extends Error {
  readonly reason: EffectAuthorityTerminalReason;
  readonly kind: EffectKind;

  constructor(reason: EffectAuthorityTerminalReason, kind: EffectKind) {
    super(`Effect authority is terminal: ${reason}`);
    this.name = 'EffectAuthorityTerminatedError';
    this.reason = reason;
    this.kind = kind;
  }
}

export class EffectAuthority {
  #terminalReason: EffectAuthorityTerminalReason | undefined;
  #cleanups: Array<() => void> = [];
  #irreversibleStarted = false;

  get terminalReason() {
    return this.#terminalReason;
  }

  get irreversibleStarted() {
    return this.#irreversibleStarted;
  }

  isActive() {
    return this.#terminalReason === undefined;
  }

  assertCancellable(kind: EffectKind = 'cancellable') {
    if (this.#terminalReason) {
      throw new EffectAuthorityTerminatedError(this.#terminalReason, kind);
    }
  }

  addCleanup(cleanup: () => void) {
    if (this.#terminalReason) {
      cleanup();
      return () => {};
    }

    this.#cleanups.push(cleanup);
    return () => {
      this.#cleanups = this.#cleanups.filter((item) => item !== cleanup);
    };
  }

  setTimeout(callback: () => void, ms: number) {
    this.assertCancellable('cancellable');
    let active = true;
    let disposeCleanup: (() => void) | undefined;
    const timer = setTimeout(() => {
      if (!active || !this.isActive()) return;
      active = false;
      disposeCleanup?.();
      callback();
    }, ms);

    disposeCleanup = this.addCleanup(() => {
      active = false;
      clearTimeout(timer);
    });

    return () => {
      if (!active) return;
      active = false;
      clearTimeout(timer);
      disposeCleanup?.();
    };
  }

  async cancellable<TValue>(
    effect: () => Promise<TValue> | TValue,
  ): Promise<TValue> {
    this.assertCancellable('cancellable');
    const value = await effect();
    this.assertCancellable('cancellable');
    return value;
  }

  async externalPreSubmit<TValue>(
    effect: () => Promise<TValue> | TValue,
  ): Promise<TValue> {
    this.assertCancellable('external_pre_submit');
    const value = await effect();
    this.assertCancellable('external_pre_submit');
    return value;
  }

  async irreversibleExecute<TValue>(
    effect: () => Promise<TValue> | TValue,
  ): Promise<TValue> {
    this.assertCancellable('irreversible_execute');
    this.#irreversibleStarted = true;
    return effect();
  }

  async postSubmitObservation<TValue>(
    effect: () => Promise<TValue> | TValue,
  ): Promise<TValue> {
    return effect();
  }

  send<TType extends ProtocolMessageType>(
    session: ProtocolSession,
    type: TType,
    payload: ProtocolPayloadByType[TType],
  ) {
    this.assertCancellable('protocol_delivery');
    return session.send(type, payload);
  }

  sendAck<TType extends ProtocolMessageType>(
    session: ProtocolSession,
    received: ProtocolEnvelope,
    type: TType,
    payload: ProtocolPayloadByType[TType],
  ) {
    this.assertCancellable('protocol_delivery');
    return session.sendAck(received, type, payload);
  }

  trySendTerminalAck(
    session: ProtocolSession,
    received: ProtocolEnvelope<'protocol.error'>,
    payload: ProtocolPayloadByType['protocol.error.ack'],
  ):
    | {
        ok: true;
        message: ProtocolEnvelope<'protocol.error.ack'>;
      }
    | {
        ok: false;
        error: Error;
      } {
    try {
      return {
        ok: true,
        message: session.sendAck(received, 'protocol.error.ack', payload),
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  async sendAndWaitForAck<
    TType extends ProtocolMessageType,
    TAckType extends ProtocolMessageType,
  >(
    session: ProtocolSession,
    params: SendAndWaitForAckParams<TType, TAckType>,
  ) {
    this.assertCancellable('protocol_delivery');
    return session.sendAndWaitForAck(params);
  }

  terminate(reason: EffectAuthorityTerminalReason = 'completed') {
    if (this.#terminalReason) return false;
    this.#terminalReason = reason;
    const cleanups = this.#cleanups.splice(0);
    for (const cleanup of cleanups) cleanup();
    return true;
  }

  cancel(reason: EffectAuthorityTerminalReason = 'cancelled') {
    return this.terminate(reason);
  }
}
