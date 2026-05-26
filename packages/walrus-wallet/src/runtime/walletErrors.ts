export type WalrusWalletErrorCode =
  | 'WALRUS_ACCOUNT_MISMATCH'
  | 'WALRUS_CHAIN_MISMATCH'
  | 'WALRUS_FEATURE_UNAVAILABLE'
  | 'WALRUS_LOGIN_ROUTE_FAILED'
  | 'WALRUS_QR_ROUTE_FAILED'
  | 'WALRUS_TRANSACTION_UNCERTAIN'
  | 'WALRUS_TRANSACTION_EXECUTION_FAILED';

export type WalrusWalletErrorDetails = Record<
  string,
  string | number | boolean | undefined
>;

export class WalrusWalletError extends Error {
  readonly code: WalrusWalletErrorCode;
  readonly details: WalrusWalletErrorDetails;

  constructor(
    code: WalrusWalletErrorCode,
    message: string,
    details: WalrusWalletErrorDetails = {},
  ) {
    super(message);
    this.name = 'WalrusWalletError';
    this.code = code;
    this.details = details;
  }
}

export class WalrusWalletAccountMismatchError extends WalrusWalletError {
  constructor({
    expected,
    received,
  }: {
    expected: string;
    received: string;
  }) {
    super(
      'WALRUS_ACCOUNT_MISMATCH',
      `Wallet request targeted account ${received}, but the active Walrus Clip account is ${expected}.`,
      { expected, received },
    );
    this.name = 'WalrusWalletAccountMismatchError';
  }
}

export class WalrusWalletChainMismatchError extends WalrusWalletError {
  constructor({
    expected,
    received,
  }: {
    expected: string;
    received: string;
  }) {
    super(
      'WALRUS_CHAIN_MISMATCH',
      `Wallet is connected to ${expected}, but the request targeted ${received}.`,
      { expected, received },
    );
    this.name = 'WalrusWalletChainMismatchError';
  }
}

export class WalrusWalletFeatureUnavailableError extends WalrusWalletError {
  constructor({
    feature,
    route,
    reason,
  }: {
    feature: string;
    route: string;
    reason: string;
  }) {
    super('WALRUS_FEATURE_UNAVAILABLE', reason, { feature, route });
    this.name = 'WalrusWalletFeatureUnavailableError';
  }
}

type WalrusWalletLoginRouteErrorInput = {
  reason: string;
  address?: string;
  network?: string;
  accountPersisted?: boolean;
};

type WalrusWalletSuiTransport = 'grpc';

export class WalrusWalletLoginRouteError extends WalrusWalletError {
  readonly address?: string;
  readonly network?: string;
  readonly accountPersisted: boolean;

  constructor({
    reason,
    address,
    network,
    accountPersisted = false,
  }: WalrusWalletLoginRouteErrorInput) {
    super('WALRUS_LOGIN_ROUTE_FAILED', reason, {
      address,
      network,
      accountPersisted,
    });
    this.name = 'WalrusWalletLoginRouteError';
    this.address = address;
    this.network = network;
    this.accountPersisted = accountPersisted;
  }
}

type WalrusWalletQrRouteErrorInput = {
  reason: string;
  digest?: string;
  bytes?: string;
  signature?: string;
  effects?: string;
  submitted?: boolean;
  finalityUnknown?: boolean;
};

export class WalrusWalletQrRouteError extends WalrusWalletError {
  readonly digest?: string;
  readonly bytes?: string;
  readonly signature?: string;
  readonly effects?: string;
  readonly submitted: boolean;
  readonly finalityUnknown: boolean;

  constructor({
    reason,
    digest,
    bytes,
    signature,
    effects,
    submitted = false,
    finalityUnknown = false,
  }: WalrusWalletQrRouteErrorInput) {
    super('WALRUS_QR_ROUTE_FAILED', reason, {
      digest,
      submitted,
      finalityUnknown,
    });
    this.name = 'WalrusWalletQrRouteError';
    this.digest = digest;
    this.bytes = bytes;
    this.signature = signature;
    this.effects = effects;
    this.submitted = submitted;
    this.finalityUnknown = finalityUnknown;
  }
}

export class WalrusWalletTransactionUncertainError extends WalrusWalletError {
  readonly digest: string;
  readonly bytes: string;
  readonly signature: string;

  constructor({
    phase,
    digest,
    bytes,
    signature,
    reason,
    suiTransport,
  }: {
    phase: 'confirmation' | 'sponsored-execution';
    digest: string;
    bytes: string;
    signature: string;
    reason: string;
    suiTransport?: WalrusWalletSuiTransport;
  }) {
    super(
      'WALRUS_TRANSACTION_UNCERTAIN',
      `Transaction ${digest} was submitted or prepared, but ${phase} did not complete: ${reason}`,
      {
        phase,
        digest,
        ...(suiTransport ? { suiTransport } : {}),
      },
    );
    this.name = 'WalrusWalletTransactionUncertainError';
    this.digest = digest;
    this.bytes = bytes;
    this.signature = signature;
  }
}

type WalrusWalletTransactionExecutionErrorInput = {
  reason: string;
  digest?: string;
  bytes?: string;
  signature?: string;
  suiTransport?: WalrusWalletSuiTransport;
};

export class WalrusWalletTransactionExecutionError extends WalrusWalletError {
  readonly digest?: string;
  readonly bytes?: string;
  readonly signature?: string;

  constructor(input: string | WalrusWalletTransactionExecutionErrorInput) {
    const normalized: WalrusWalletTransactionExecutionErrorInput =
      typeof input === 'string' ? { reason: input } : input;
    super('WALRUS_TRANSACTION_EXECUTION_FAILED', normalized.reason, {
      ...(normalized.digest ? { digest: normalized.digest } : {}),
      ...(normalized.suiTransport
        ? { suiTransport: normalized.suiTransport }
        : {}),
    });
    this.name = 'WalrusWalletTransactionExecutionError';
    this.digest = normalized.digest;
    this.bytes = normalized.bytes;
    this.signature = normalized.signature;
  }
}
