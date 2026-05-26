import type { NETWORK } from '../types';

export const PROTOCOL_VERSION = 1 as const;
export const DEFAULT_PROTOCOL_MESSAGE_TTL_MS = 5 * 60 * 1000;

export type ProtocolMessageType =
  | 'login.proof'
  | 'login.result'
  | 'login.result.ack'
  | 'sign.address'
  | 'sign.transaction'
  | 'sign.response'
  | 'sign.submitted'
  | 'sign.submitted.ack'
  | 'sign.finalized'
  | 'sign.finalized.ack'
  | 'protocol.error'
  | 'protocol.error.ack';

export type ProtocolErrorCode =
  | 'invalid_json'
  | 'invalid_envelope'
  | 'unsupported_version'
  | 'session_mismatch'
  | 'network_mismatch'
  | 'sequence_mismatch'
  | 'type_mismatch'
  | 'message_expired'
  | 'session_timeout'
  | 'unknown_type'
  | 'invalid_payload'
  | 'invalid_peer_id'
  | 'invalid_challenge'
  | 'verification_failed'
  | 'transaction_rejected'
  | 'transaction_validation_failed'
  | 'transaction_failed'
  | 'sponsor_failed'
  | 'internal_error';

export type ProtocolErrorDetails = Record<
  string,
  string | number | boolean | undefined
>;

export type LoginProofPayload = {
  address: string;
  publicKey: string;
  signature: string;
  challenge: string;
};

export type LoginResultPayload = {
  accepted: true;
  address: string;
};

export type LoginAckPayload = {
  accepted: true;
  ackSequence: number;
};

export type SignAddressPayload = {
  address: string;
};

export type SignTransactionPayload = {
  bytes: string;
  expectedDigest?: string;
};

export type SignResponsePayload = {
  signature: string;
};

export type SignSubmittedPayload = {
  digest: string;
};

export type SignSubmittedAckPayload = {
  digest: string;
  ackSequence: number;
};

export type SignFinalizedPayload = {
  digest: string;
  effects: string;
};

export type SignFinalizedAckPayload = {
  digest: string;
  ackSequence: number;
};

export type ProtocolErrorPayload = {
  code: ProtocolErrorCode;
  message: string;
  details?: ProtocolErrorDetails;
};

export type ProtocolErrorAckPayload = {
  code: ProtocolErrorCode;
  ackSequence: number;
};

export type ProtocolPayloadByType = {
  'login.proof': LoginProofPayload;
  'login.result': LoginResultPayload;
  'login.result.ack': LoginAckPayload;
  'sign.address': SignAddressPayload;
  'sign.transaction': SignTransactionPayload;
  'sign.response': SignResponsePayload;
  'sign.submitted': SignSubmittedPayload;
  'sign.submitted.ack': SignSubmittedAckPayload;
  'sign.finalized': SignFinalizedPayload;
  'sign.finalized.ack': SignFinalizedAckPayload;
  'protocol.error': ProtocolErrorPayload;
  'protocol.error.ack': ProtocolErrorAckPayload;
};

export type ProtocolEnvelope<
  TType extends ProtocolMessageType = ProtocolMessageType,
> = TType extends ProtocolMessageType
  ? {
      version: typeof PROTOCOL_VERSION;
      sessionId: string;
      network: NETWORK;
      sequence: number;
      type: TType;
      expiresAt: number;
      payload: ProtocolPayloadByType[TType];
    }
  : never;

type CreateProtocolMessageParams<TType extends ProtocolMessageType> = {
  sessionId: string;
  network: NETWORK;
  sequence: number;
  type: TType;
  payload: ProtocolPayloadByType[TType];
  expiresAt?: number;
  ttlMs?: number;
  now?: number;
};

type ParseProtocolMessageOptions<TExpected extends ProtocolMessageType> = {
  expectedSessionId: string;
  expectedNetwork: NETWORK;
  expectedType?: TExpected | readonly TExpected[];
  now?: number;
};

const PROTOCOL_MESSAGE_TYPES = new Set<ProtocolMessageType>([
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
]);

const PROTOCOL_ERROR_CODES = new Set<ProtocolErrorCode>([
  'invalid_json',
  'invalid_envelope',
  'unsupported_version',
  'session_mismatch',
  'network_mismatch',
  'sequence_mismatch',
  'type_mismatch',
  'message_expired',
  'session_timeout',
  'unknown_type',
  'invalid_payload',
  'invalid_peer_id',
  'invalid_challenge',
  'verification_failed',
  'transaction_rejected',
  'transaction_validation_failed',
  'transaction_failed',
  'sponsor_failed',
  'internal_error',
]);

const SUPPORTED_NETWORKS = new Set<NETWORK>(['mainnet', 'testnet', 'devnet']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isProtocolSequence = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value > 0;

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
) => Object.keys(value).every((key) => allowedKeys.includes(key));

const isProtocolNetwork = (value: unknown): value is NETWORK =>
  typeof value === 'string' && SUPPORTED_NETWORKS.has(value as NETWORK);

const isProtocolMessageType = (value: unknown): value is ProtocolMessageType =>
  typeof value === 'string' &&
  PROTOCOL_MESSAGE_TYPES.has(value as ProtocolMessageType);

const isProtocolErrorCode = (value: unknown): value is ProtocolErrorCode =>
  typeof value === 'string' &&
  PROTOCOL_ERROR_CODES.has(value as ProtocolErrorCode);

const isProtocolErrorDetails = (
  value: unknown,
): value is ProtocolErrorDetails => {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;

  return Object.values(value).every((item) => {
    const itemType = typeof item;
    return (
      item === undefined ||
      itemType === 'string' ||
      itemType === 'number' ||
      itemType === 'boolean'
    );
  });
};

const payloadValidators: {
  [TType in ProtocolMessageType]: (
    payload: unknown,
  ) => payload is ProtocolPayloadByType[TType];
} = {
  'login.proof': (payload): payload is LoginProofPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['address', 'publicKey', 'signature', 'challenge']) &&
    isNonEmptyString(payload.address) &&
    isNonEmptyString(payload.publicKey) &&
    isNonEmptyString(payload.signature) &&
    isNonEmptyString(payload.challenge),
  'login.result': (payload): payload is LoginResultPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['accepted', 'address']) &&
    payload.accepted === true &&
    isNonEmptyString(payload.address),
  'login.result.ack': (payload): payload is LoginAckPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['accepted', 'ackSequence']) &&
    payload.accepted === true &&
    isProtocolSequence(payload.ackSequence),
  'sign.address': (payload): payload is SignAddressPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['address']) &&
    isNonEmptyString(payload.address),
  'sign.transaction': (payload): payload is SignTransactionPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['bytes', 'expectedDigest']) &&
    isNonEmptyString(payload.bytes) &&
    (payload.expectedDigest === undefined ||
      isNonEmptyString(payload.expectedDigest)),
  'sign.response': (payload): payload is SignResponsePayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['signature']) &&
    isNonEmptyString(payload.signature),
  'sign.submitted': (payload): payload is SignSubmittedPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['digest']) &&
    isNonEmptyString(payload.digest),
  'sign.submitted.ack': (payload): payload is SignSubmittedAckPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['digest', 'ackSequence']) &&
    isNonEmptyString(payload.digest) &&
    isProtocolSequence(payload.ackSequence),
  'sign.finalized': (payload): payload is SignFinalizedPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['digest', 'effects']) &&
    isNonEmptyString(payload.digest) &&
    typeof payload.effects === 'string',
  'sign.finalized.ack': (payload): payload is SignFinalizedAckPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['digest', 'ackSequence']) &&
    isNonEmptyString(payload.digest) &&
    isProtocolSequence(payload.ackSequence),
  'protocol.error': (payload): payload is ProtocolErrorPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['code', 'message', 'details']) &&
    isProtocolErrorCode(payload.code) &&
    isNonEmptyString(payload.message) &&
    isProtocolErrorDetails(payload.details),
  'protocol.error.ack': (payload): payload is ProtocolErrorAckPayload =>
    isRecord(payload) &&
    hasOnlyKeys(payload, ['code', 'ackSequence']) &&
    isProtocolErrorCode(payload.code) &&
    isProtocolSequence(payload.ackSequence),
};

export class ProtocolMessageError extends Error {
  readonly payload: ProtocolErrorPayload;

  constructor(payload: ProtocolErrorPayload) {
    super(payload.message);
    this.name = 'ProtocolMessageError';
    this.payload = payload;
  }
}

export const createProtocolErrorPayload = (
  code: ProtocolErrorCode,
  message: string,
  details?: ProtocolErrorDetails,
): ProtocolErrorPayload => ({
  code,
  message,
  ...(details ? { details } : {}),
});

const fail = (
  code: ProtocolErrorCode,
  message: string,
  details?: ProtocolErrorDetails,
): never => {
  throw new ProtocolMessageError(
    createProtocolErrorPayload(code, message, details),
  );
};

export const formatProtocolError = (payload: ProtocolErrorPayload): string =>
  `${payload.code}: ${payload.message}`;

export const isProtocolErrorMessage = (
  message: ProtocolEnvelope,
): message is ProtocolEnvelope<'protocol.error'> =>
  message.type === 'protocol.error';

export const createProtocolMessage = <
  TType extends ProtocolMessageType,
>({
  sessionId,
  network,
  sequence,
  type,
  payload,
  expiresAt,
  ttlMs = DEFAULT_PROTOCOL_MESSAGE_TTL_MS,
  now = Date.now(),
}: CreateProtocolMessageParams<TType>): string => {
  if (!isNonEmptyString(sessionId)) {
    fail('invalid_envelope', 'Protocol sessionId must be a non-empty string');
  }
  if (!isProtocolNetwork(network)) {
    fail('invalid_envelope', 'Protocol network is invalid');
  }
  if (!isProtocolSequence(sequence)) {
    fail('invalid_envelope', 'Protocol sequence is invalid');
  }
  if (!isProtocolMessageType(type)) {
    fail('unknown_type', 'Protocol message type is unsupported');
  }

  const resolvedExpiresAt = expiresAt ?? now + ttlMs;
  if (!Number.isFinite(resolvedExpiresAt) || resolvedExpiresAt <= now) {
    fail('message_expired', 'Protocol message expiry must be in the future');
  }

  const payloadValidator = payloadValidators[type] as (
    candidate: unknown,
  ) => boolean;
  if (!payloadValidator(payload)) {
    fail('invalid_payload', `Invalid payload for protocol message ${type}`);
  }

  const envelope = {
    version: PROTOCOL_VERSION,
    sessionId,
    network,
    sequence,
    type,
    expiresAt: resolvedExpiresAt,
    payload,
  } as ProtocolEnvelope<TType>;

  return JSON.stringify(envelope);
};

export const createProtocolErrorMessage = ({
  sessionId,
  network,
  sequence,
  payload,
  expiresAt,
  ttlMs,
  now,
}: Omit<CreateProtocolMessageParams<'protocol.error'>, 'type'>): string =>
  createProtocolMessage({
    sessionId,
    network,
    sequence,
    type: 'protocol.error',
    payload,
    expiresAt,
    ttlMs,
    now,
  });

export const parseProtocolMessage = <
  TExpected extends ProtocolMessageType = ProtocolMessageType,
>(
  data: unknown,
  {
    expectedSessionId,
    expectedNetwork,
    expectedType,
    now = Date.now(),
  }: ParseProtocolMessageOptions<TExpected>,
): ProtocolEnvelope<TExpected> => {
  if (typeof data !== 'string') {
    fail('invalid_json', 'Protocol message must be a string');
  }
  const rawData = data as string;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    fail('invalid_json', 'Protocol message must be valid JSON');
  }

  if (!isRecord(parsed)) {
    fail('invalid_envelope', 'Protocol message must be an object');
  }
  const candidate = parsed as Record<string, unknown>;

  if (
    !hasOnlyKeys(candidate, [
      'version',
      'sessionId',
      'network',
      'sequence',
      'type',
      'expiresAt',
      'payload',
    ])
  ) {
    fail('invalid_envelope', 'Protocol message contains unknown fields');
  }

  if (candidate.version !== PROTOCOL_VERSION) {
    fail('unsupported_version', 'Unsupported protocol version');
  }

  const parsedSessionId = candidate.sessionId;
  if (!isNonEmptyString(parsedSessionId)) {
    fail('invalid_envelope', 'Protocol sessionId must be a non-empty string');
  }
  if (parsedSessionId !== expectedSessionId) {
    fail('session_mismatch', 'Protocol sessionId does not match');
  }

  const parsedNetwork = candidate.network;
  if (!isProtocolNetwork(parsedNetwork)) {
    fail('invalid_envelope', 'Protocol network is invalid');
  }
  if (parsedNetwork !== expectedNetwork) {
    fail('network_mismatch', 'Protocol network does not match');
  }

  const parsedSequence = candidate.sequence;
  if (!isProtocolSequence(parsedSequence)) {
    fail('invalid_envelope', 'Protocol sequence is invalid');
  }

  if (!isProtocolMessageType(candidate.type)) {
    fail('unknown_type', 'Protocol message type is unsupported');
  }
  const parsedType = candidate.type as ProtocolMessageType;

  const expectedTypes =
    expectedType === undefined
      ? undefined
      : Array.isArray(expectedType)
        ? expectedType
        : [expectedType];

  if (
    expectedTypes &&
    !expectedTypes.includes(parsedType as TExpected)
  ) {
    fail('type_mismatch', 'Protocol message type does not match');
  }

  if (
    typeof candidate.expiresAt !== 'number' ||
    !Number.isFinite(candidate.expiresAt)
  ) {
    fail('invalid_envelope', 'Protocol expiresAt must be a finite number');
  }
  const parsedExpiresAt = candidate.expiresAt as number;
  if (parsedExpiresAt <= now) {
    fail('message_expired', 'Protocol message has expired');
  }

  const payloadValidator = payloadValidators[parsedType] as (
    candidate: unknown,
  ) => boolean;
  if (!payloadValidator(candidate.payload)) {
    fail(
      'invalid_payload',
      `Invalid payload for protocol message ${parsedType}`,
    );
  }

  return {
    version: PROTOCOL_VERSION,
    sessionId: parsedSessionId,
    network: parsedNetwork,
    sequence: parsedSequence,
    type: parsedType,
    expiresAt: parsedExpiresAt,
    payload: candidate.payload,
  } as ProtocolEnvelope<TExpected>;
};
