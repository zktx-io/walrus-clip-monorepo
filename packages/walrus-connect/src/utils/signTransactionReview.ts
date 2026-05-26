import { bcs } from '@mysten/sui/bcs';
import type {
  BalanceChange,
  DryRunTransactionBlockResponse,
  SuiClient,
  SuiEvent,
  SuiObjectChange,
} from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import {
  fromBase64,
  isValidSuiAddress,
  normalizeSuiAddress,
  toHex,
} from '@mysten/sui/utils';

import type {
  NETWORK,
  SignTransactionReview,
  SignTransactionReviewCommand,
  SignTransactionReviewFact,
  SignTransactionReviewInput,
} from '../types';

type SignTransactionProtocolErrorCode =
  | 'invalid_payload'
  | 'transaction_rejected'
  | 'transaction_validation_failed';

export type SignTransactionValidationError = {
  code: SignTransactionProtocolErrorCode;
  message: string;
};

type NormalizeSignTransactionAddressResult =
  | { ok: true; address: string }
  | { ok: false; error: SignTransactionValidationError };

type ReviewArgumentContext = 'address' | 'amount' | 'object' | 'generic';

type DescribedArgument = {
  summary: string;
  value?: string;
  details: SignTransactionReviewFact[];
  warnings: string[];
};

type ReviewTransactionData = ReturnType<Transaction['getData']>;

const UNKNOWN = 'unknown';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const stringifyJson = (value: unknown): string | undefined => {
  try {
    return JSON.stringify(value, (_, item) =>
      typeof item === 'bigint' ? item.toString() : item,
    );
  } catch {
    return undefined;
  }
};

const stringifyValue = (value: unknown): string => {
  if (value === undefined || value === null) return UNKNOWN;
  if (typeof value === 'string') return value.length > 0 ? value : UNKNOWN;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return stringifyJson(value) ?? UNKNOWN;
};

const fact = (label: string, value: unknown): SignTransactionReviewFact => ({
  label,
  value: stringifyValue(value),
});

const variantKind = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  if (typeof value.$kind === 'string') return value.$kind;
  return Object.keys(value).find((key) => key !== '$kind');
};

const variantValue = (value: unknown, kind?: string): unknown => {
  if (!isRecord(value)) return undefined;
  const resolvedKind = kind ?? variantKind(value);
  return resolvedKind ? value[resolvedKind] : undefined;
};

const decodePureBytes = (base64: string): Uint8Array | undefined => {
  try {
    return fromBase64(base64);
  } catch {
    return undefined;
  }
};

const decodePureAddress = (base64: string): string | undefined => {
  const bytes = decodePureBytes(base64);
  if (!bytes || bytes.length !== 32) return undefined;

  const address = `0x${toHex(bytes)}`;
  return isValidSuiAddress(address) ? normalizeSuiAddress(address) : undefined;
};

const decodePureU64 = (base64: string): string | undefined => {
  const bytes = decodePureBytes(base64);
  if (!bytes || bytes.length !== 8) return undefined;

  try {
    return String(bcs.u64().parse(bytes));
  } catch {
    return undefined;
  }
};

const describeOwner = (owner: unknown): string => {
  if (typeof owner === 'string') return owner;
  if (!isRecord(owner)) return UNKNOWN;

  const kind = variantKind(owner);
  const value = variantValue(owner, kind);
  return kind ? `${kind}: ${stringifyValue(value)}` : stringifyValue(owner);
};

const describeObjectRef = (value: unknown): string => {
  if (!isRecord(value)) return UNKNOWN;
  const objectId = stringifyValue(value.objectId);
  const version = stringifyValue(value.version);
  const digest = stringifyValue(value.digest);
  return `${objectId} (version ${version}, digest ${digest})`;
};

const describeObjectArgumentValue = (value: unknown): DescribedArgument => {
  const details: SignTransactionReviewFact[] = [];
  const warnings: string[] = [];

  if (!isRecord(value)) {
    return {
      summary: UNKNOWN,
      details: [fact('Object', UNKNOWN)],
      warnings: ['Object argument is not structured.'],
    };
  }

  const kind = variantKind(value) ?? 'UnknownObject';
  const payload = variantValue(value, kind);
  details.push(fact('Object kind', kind));

  if (kind === 'ImmOrOwnedObject' || kind === 'Receiving') {
    const summary = describeObjectRef(payload);
    if (isRecord(payload)) {
      details.push(fact('Object id', payload.objectId));
      details.push(fact('Version', payload.version));
      details.push(fact('Digest', payload.digest));
    }
    return { summary, details, warnings };
  }

  if (kind === 'SharedObject' && isRecord(payload)) {
    const objectId = stringifyValue(payload.objectId);
    details.push(fact('Object id', payload.objectId));
    details.push(fact('Initial shared version', payload.initialSharedVersion));
    details.push(fact('Mutable', payload.mutable));
    return {
      summary: `${objectId} (shared, mutable ${stringifyValue(
        payload.mutable,
      )})`,
      details,
      warnings,
    };
  }

  if (kind === 'UnresolvedObject' && isRecord(payload)) {
    details.push(fact('Object id', payload.objectId));
    details.push(fact('Version', payload.version));
    details.push(fact('Digest', payload.digest));
    details.push(fact('Initial shared version', payload.initialSharedVersion));
    details.push(fact('Mutable', payload.mutable));
    return {
      summary: stringifyValue(payload.objectId),
      details,
      warnings,
    };
  }

  warnings.push(`Unsupported object argument kind ${kind}.`);
  details.push(fact('Raw object', payload));
  return {
    summary: `${kind}: ${stringifyValue(payload)}`,
    details,
    warnings,
  };
};

const describeCallArg = (
  input: unknown,
  context: ReviewArgumentContext,
): DescribedArgument => {
  if (!isRecord(input)) {
    return {
      summary: UNKNOWN,
      details: [fact('Input', UNKNOWN)],
      warnings: ['Input is not structured.'],
    };
  }

  const kind = variantKind(input) ?? 'UnknownInput';
  const payload = variantValue(input, kind);
  const details: SignTransactionReviewFact[] = [fact('Input kind', kind)];
  const warnings: string[] = [];

  if (kind === 'Pure' && isRecord(payload)) {
    const bytes = isNonEmptyString(payload.bytes) ? payload.bytes : undefined;
    details.push(fact('Pure bytes', bytes));

    if (bytes && (context === 'address' || context === 'generic')) {
      const decodedAddress = decodePureAddress(bytes);
      if (decodedAddress) {
        details.push(fact('Decoded address', decodedAddress));
        if (context === 'address') {
          return {
            summary: decodedAddress,
            value: decodedAddress,
            details,
            warnings,
          };
        }
      }
    }

    if (bytes && (context === 'amount' || context === 'generic')) {
      const decodedU64 = decodePureU64(bytes);
      if (decodedU64) {
        details.push(fact('Decoded u64', decodedU64));
        if (context === 'amount') {
          return {
            summary: decodedU64,
            value: decodedU64,
            details,
            warnings,
          };
        }
      }
    }

    if (context === 'address') {
      warnings.push('Address input could not be decoded from pure bytes.');
    }
    if (context === 'amount') {
      warnings.push('Amount input could not be decoded as u64.');
    }
    return {
      summary: bytes ? `pure bytes ${bytes}` : UNKNOWN,
      value: bytes,
      details,
      warnings,
    };
  }

  if (kind === 'Object' || kind === 'UnresolvedObject') {
    const objectDescription =
      kind === 'Object'
        ? describeObjectArgumentValue(payload)
        : describeObjectArgumentValue(input);
    return {
      ...objectDescription,
      details: [...details, ...objectDescription.details],
      warnings: [...warnings, ...objectDescription.warnings],
    };
  }

  if (kind === 'UnresolvedPure' && isRecord(payload)) {
    details.push(fact('Value', payload.value));
    return {
      summary: stringifyValue(payload.value),
      value: stringifyValue(payload.value),
      details,
      warnings,
    };
  }

  warnings.push(`Unsupported input kind ${kind}.`);
  details.push(fact('Raw input', payload));
  return {
    summary: `${kind}: ${stringifyValue(payload)}`,
    value: stringifyValue(payload),
    details,
    warnings,
  };
};

const getInput = (
  data: ReviewTransactionData,
  index: number,
): unknown | undefined => data.inputs[index];

const describeArgument = (
  argument: unknown,
  data: ReviewTransactionData,
  context: ReviewArgumentContext = 'generic',
): DescribedArgument => {
  if (!isRecord(argument)) {
    return {
      summary: UNKNOWN,
      details: [fact('Argument', UNKNOWN)],
      warnings: ['Argument is not structured.'],
    };
  }

  const kind = variantKind(argument) ?? 'UnknownArgument';
  const payload = variantValue(argument, kind);
  const details: SignTransactionReviewFact[] = [fact('Argument kind', kind)];
  const warnings: string[] = [];

  if (kind === 'GasCoin') {
    return {
      summary: 'gas coin',
      value: 'gas coin',
      details,
      warnings,
    };
  }

  if (kind === 'Input' && typeof payload === 'number') {
    const input = getInput(data, payload);
    const inputDescription = describeCallArg(input, context);
    details.push(fact('Input index', payload));
    if (typeof argument.type === 'string') {
      details.push(fact('Input type hint', argument.type));
    }
    return {
      summary: `input #${payload}: ${inputDescription.summary}`,
      value: inputDescription.value,
      details: [...details, ...inputDescription.details],
      warnings: [...warnings, ...inputDescription.warnings],
    };
  }

  if (kind === 'Result' && typeof payload === 'number') {
    return {
      summary: `result #${payload}`,
      value: `result #${payload}`,
      details: [...details, fact('Command result', payload)],
      warnings,
    };
  }

  if (
    kind === 'NestedResult' &&
    Array.isArray(payload) &&
    payload.length === 2
  ) {
    const summary = `result #${stringifyValue(payload[0])}.${stringifyValue(
      payload[1],
    )}`;
    return {
      summary,
      value: summary,
      details: [
        ...details,
        fact('Command index', payload[0]),
        fact('Result index', payload[1]),
      ],
      warnings,
    };
  }

  warnings.push(`Unsupported argument kind ${kind}.`);
  details.push(fact('Raw argument', payload));
  return {
    summary: `${kind}: ${stringifyValue(payload)}`,
    value: stringifyValue(payload),
    details,
    warnings,
  };
};

const describeInput = (
  input: unknown,
  index: number,
): SignTransactionReviewInput => {
  const description = describeCallArg(input, 'generic');
  return {
    index,
    kind: variantKind(input) ?? 'UnknownInput',
    summary: description.summary,
    details: description.details,
  };
};

const addArgumentDetails = (
  details: SignTransactionReviewFact[],
  label: string,
  argument: DescribedArgument,
) => {
  details.push(fact(label, argument.summary));
  for (const item of argument.details) {
    details.push(fact(`${label} ${item.label}`, item.value));
  }
};

const describeCommand = (
  command: unknown,
  index: number,
  data: ReviewTransactionData,
): SignTransactionReviewCommand => {
  const kind = variantKind(command) ?? 'UnknownCommand';
  const payload = variantValue(command, kind);
  const details: SignTransactionReviewFact[] = [];
  const warnings: string[] = [];

  if (!isRecord(payload)) {
    return {
      index,
      kind,
      summary: `${kind}: unsupported command shape`,
      details: [fact('Raw command', payload)],
      warnings: [`Command ${index + 1} has unsupported shape.`],
    };
  }

  if (kind === 'MoveCall') {
    const target = `${stringifyValue(payload.package)}::${stringifyValue(
      payload.module,
    )}::${stringifyValue(payload.function)}`;
    details.push(fact('Target', target));
    details.push(fact('Package', payload.package));
    details.push(fact('Module', payload.module));
    details.push(fact('Function', payload.function));
    details.push(fact('Type arguments', payload.typeArguments));

    const args = Array.isArray(payload.arguments) ? payload.arguments : [];
    args.forEach((argument, argIndex) => {
      const described = describeArgument(argument, data);
      addArgumentDetails(details, `Argument ${argIndex + 1}`, described);
      warnings.push(...described.warnings);
    });

    return {
      index,
      kind,
      summary: `Move call ${target}`,
      details,
      warnings,
    };
  }

  if (kind === 'TransferObjects') {
    const recipient = describeArgument(payload.address, data, 'address');
    addArgumentDetails(details, 'Recipient', recipient);
    warnings.push(...recipient.warnings);

    const objects = Array.isArray(payload.objects) ? payload.objects : [];
    objects.forEach((object, objectIndex) => {
      const described = describeArgument(object, data, 'object');
      addArgumentDetails(details, `Object ${objectIndex + 1}`, described);
      warnings.push(...described.warnings);
    });

    return {
      index,
      kind,
      summary: `Transfer ${objects.length} object(s) to ${recipient.value ?? recipient.summary}`,
      details,
      warnings,
    };
  }

  if (kind === 'SplitCoins') {
    const coin = describeArgument(payload.coin, data, 'object');
    addArgumentDetails(details, 'Coin', coin);
    warnings.push(...coin.warnings);

    const amounts = Array.isArray(payload.amounts) ? payload.amounts : [];
    const amountSummaries = amounts.map((amount, amountIndex) => {
      const described = describeArgument(amount, data, 'amount');
      addArgumentDetails(details, `Amount ${amountIndex + 1}`, described);
      warnings.push(...described.warnings);
      return described.value ?? described.summary;
    });

    return {
      index,
      kind,
      summary: `Split coin into ${amountSummaries.join(', ') || UNKNOWN}`,
      details,
      warnings,
    };
  }

  if (kind === 'MergeCoins') {
    const destination = describeArgument(payload.destination, data, 'object');
    addArgumentDetails(details, 'Destination', destination);
    warnings.push(...destination.warnings);

    const sources = Array.isArray(payload.sources) ? payload.sources : [];
    sources.forEach((source, sourceIndex) => {
      const described = describeArgument(source, data, 'object');
      addArgumentDetails(details, `Source ${sourceIndex + 1}`, described);
      warnings.push(...described.warnings);
    });

    return {
      index,
      kind,
      summary: `Merge ${sources.length} source coin(s) into ${destination.summary}`,
      details,
      warnings,
    };
  }

  if (kind === 'Publish') {
    const modules = Array.isArray(payload.modules) ? payload.modules : [];
    const dependencies = Array.isArray(payload.dependencies)
      ? payload.dependencies
      : [];
    details.push(fact('Module count', modules.length));
    details.push(fact('Dependencies', dependencies));
    return {
      index,
      kind,
      summary: `Publish ${modules.length} module(s)`,
      details,
      warnings,
    };
  }

  if (kind === 'MakeMoveVec') {
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    details.push(fact('Element type', payload.type));
    elements.forEach((element, elementIndex) => {
      const described = describeArgument(element, data);
      addArgumentDetails(details, `Element ${elementIndex + 1}`, described);
      warnings.push(...described.warnings);
    });
    return {
      index,
      kind,
      summary: `Make Move vector with ${elements.length} element(s)`,
      details,
      warnings,
    };
  }

  if (kind === 'Upgrade') {
    const modules = Array.isArray(payload.modules) ? payload.modules : [];
    const dependencies = Array.isArray(payload.dependencies)
      ? payload.dependencies
      : [];
    const ticket = describeArgument(payload.ticket, data);
    details.push(fact('Package', payload.package));
    details.push(fact('Module count', modules.length));
    details.push(fact('Dependencies', dependencies));
    addArgumentDetails(details, 'Ticket', ticket);
    warnings.push(...ticket.warnings);
    return {
      index,
      kind,
      summary: `Upgrade package ${stringifyValue(payload.package)}`,
      details,
      warnings,
    };
  }

  if (kind === '$Intent') {
    warnings.push('Transaction contains an unresolved SDK intent command.');
    details.push(fact('Intent name', payload.name));
    details.push(fact('Intent inputs', payload.inputs));
    details.push(fact('Intent data', payload.data));
    return {
      index,
      kind,
      summary: `Unsupported unresolved intent ${stringifyValue(payload.name)}`,
      details,
      warnings,
    };
  }

  return {
    index,
    kind,
    summary: `${kind}: unsupported command`,
    details: [fact('Raw command', payload)],
    warnings: [`Unsupported command kind ${kind}.`],
  };
};

const describeBalanceChange = (change: BalanceChange, index: number) => ({
  index,
  owner: describeOwner(change.owner),
  coinType: change.coinType,
  amount: change.amount,
  summary: `${change.amount} ${change.coinType} for ${describeOwner(
    change.owner,
  )}`,
});

const describeObjectChange = (
  change: SuiObjectChange,
  index: number,
) => {
  const record = change as unknown as Record<string, unknown>;
  const type = stringifyValue(record.type);
  const objectId = stringifyValue(record.objectId ?? record.packageId);
  const objectType = stringifyValue(record.objectType);
  const summary =
    type === 'published'
      ? `Published package ${stringifyValue(record.packageId)}`
      : `${type} ${objectId}${objectType !== UNKNOWN ? ` (${objectType})` : ''}`;

  return {
    index,
    type,
    summary,
    details: [
      fact('Object id', record.objectId),
      fact('Object type', record.objectType),
      fact('Package id', record.packageId),
      fact('Owner', describeOwner(record.owner)),
      fact('Recipient', describeOwner(record.recipient)),
      fact('Sender', record.sender),
      fact('Version', record.version),
      fact('Previous version', record.previousVersion),
      fact('Digest', record.digest),
      fact('Modules', record.modules),
    ],
  };
};

const describeEvent = (event: SuiEvent, index: number) => {
  const record = event as unknown as Record<string, unknown>;
  const eventType = stringifyValue(record.type);
  const moduleName = stringifyValue(record.transactionModule);
  const packageId = stringifyValue(record.packageId);

  return {
    index,
    type: eventType,
    summary: `${eventType} from ${packageId}::${moduleName}`,
    details: [
      fact('Package id', record.packageId),
      fact('Module', record.transactionModule),
      fact('Sender', record.sender),
      fact('Event id', record.id),
      fact('Parsed JSON', record.parsedJson),
    ],
  };
};

const formatFactLines = (
  facts: SignTransactionReviewFact[],
  indent = '    ',
) =>
  facts.map((item) => `${indent}${item.label}: ${item.value}`);

const formatSection = (title: string, lines: string[]) =>
  lines.length > 0 ? [title, ...lines] : [title, '  none'];

const collectReviewWarnings = (
  commands: SignTransactionReviewCommand[],
): string[] =>
  commands.flatMap((command) =>
    command.warnings.map(
      (warning) => `Command ${command.index + 1} (${command.kind}): ${warning}`,
    ),
  );

export const normalizeSignTransactionAddress = (
  address: string,
): NormalizeSignTransactionAddressResult => {
  if (!isValidSuiAddress(address)) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message: 'Signer address is invalid',
      },
    };
  }

  return { ok: true, address: normalizeSuiAddress(address) };
};

export const getTransactionSenderValidationError = (
  tx: Transaction,
  expectedAddress: string,
): SignTransactionValidationError | undefined => {
  const sender = tx.getData().sender;
  if (!sender) {
    return {
      code: 'transaction_validation_failed',
      message: 'Transaction is missing sender',
    };
  }

  const normalizedSender = normalizeSignTransactionAddress(sender);
  if (!normalizedSender.ok) return normalizedSender.error;

  const normalizedExpected = normalizeSignTransactionAddress(expectedAddress);
  if (!normalizedExpected.ok) return normalizedExpected.error;

  if (normalizedSender.address !== normalizedExpected.address) {
    return {
      code: 'transaction_validation_failed',
      message: 'Transaction sender does not match signer address',
    };
  }

  return undefined;
};

export const deriveSignTransactionSponsorship = (
  tx: Transaction,
): {
  sponsored: boolean;
  status: 'self-funded' | 'sponsored' | 'unknown';
  gasOwner: string;
  warning?: string;
} => {
  const data = tx.getData();
  const gasOwner = data.gasData.owner;

  if (!isNonEmptyString(gasOwner)) {
    return {
      sponsored: false,
      status: 'unknown',
      gasOwner: UNKNOWN,
      warning: 'Gas owner is missing; sponsorship status could not be verified.',
    };
  }

  const normalizedGasOwner = normalizeSignTransactionAddress(gasOwner);
  if (!normalizedGasOwner.ok) {
    return {
      sponsored: false,
      status: 'unknown',
      gasOwner: stringifyValue(gasOwner),
      warning: 'Gas owner is invalid; sponsorship status could not be verified.',
    };
  }

  if (!data.sender) {
    return {
      sponsored: false,
      status: 'unknown',
      gasOwner: normalizedGasOwner.address,
      warning: 'Transaction sender is missing; sponsorship status could not be verified.',
    };
  }

  const normalizedSender = normalizeSignTransactionAddress(data.sender);
  if (!normalizedSender.ok) {
    return {
      sponsored: false,
      status: 'unknown',
      gasOwner: normalizedGasOwner.address,
      warning: 'Transaction sender is invalid; sponsorship status could not be verified.',
    };
  }

  const sponsored = normalizedGasOwner.address !== normalizedSender.address;
  return {
    sponsored,
    status: sponsored ? 'sponsored' : 'self-funded',
    gasOwner: normalizedGasOwner.address,
  };
};

export const approveSignTransactionReview = async (
  review: SignTransactionReview,
  reviewer: (review: SignTransactionReview) => boolean | Promise<boolean>,
): Promise<
  { ok: true } | { ok: false; error: SignTransactionValidationError }
> => {
  const approved = await reviewer(review);
  if (approved) return { ok: true };

  return {
    ok: false,
    error: {
      code: 'transaction_rejected',
      message: 'User rejected transaction review',
    },
  };
};

export const createSignTransactionReview = async ({
  tx,
  client,
  bytes,
  digest,
  network,
}: {
  tx: Transaction;
  client: SuiClient;
  bytes: string;
  digest?: string;
  network: NETWORK;
}): Promise<
  | { ok: true; review: SignTransactionReview }
  | { ok: false; error: SignTransactionValidationError }
> => {
  const data = tx.getData();
  if (!data.sender) {
    return {
      ok: false,
      error: {
        code: 'transaction_validation_failed',
        message: 'Transaction is missing sender',
      },
    };
  }

  let dryRun: DryRunTransactionBlockResponse;
  try {
    dryRun = await client.dryRunTransactionBlock({ transactionBlock: bytes });
  } catch {
    return {
      ok: false,
      error: {
        code: 'transaction_validation_failed',
        message: 'Transaction dry run failed',
      },
    };
  }

  const status = dryRun.effects?.status;
  if (status?.status !== 'success') {
    return {
      ok: false,
      error: {
        code: 'transaction_validation_failed',
        message: status?.error
          ? `Transaction dry run failed: ${status.error}`
          : 'Transaction dry run failed',
      },
    };
  }

  const commands = data.commands.map((command, index) =>
    describeCommand(command, index, data),
  );
  const sponsorship = deriveSignTransactionSponsorship(tx);
  const warnings = [
    ...collectReviewWarnings(commands),
    ...(sponsorship.warning ? [sponsorship.warning] : []),
  ];

  return {
    ok: true,
    review: {
      network,
      sender: data.sender,
      digest,
      sponsored: sponsorship.sponsored,
      gas: {
        owner: stringifyValue(data.gasData.owner),
        budget: stringifyValue(data.gasData.budget),
        price: stringifyValue(data.gasData.price),
        payments: (data.gasData.payment ?? []).map((payment) => ({
          objectId: stringifyValue(payment.objectId),
          version: stringifyValue(payment.version),
          digest: stringifyValue(payment.digest),
        })),
      },
      inputs: data.inputs.map(describeInput),
      commands,
      dryRun: {
        status: 'success',
        balanceChanges: dryRun.balanceChanges.map(describeBalanceChange),
        objectChanges: dryRun.objectChanges.map(describeObjectChange),
        events: dryRun.events.map(describeEvent),
      },
      warnings,
    },
  };
};

export const formatSignTransactionReview = (
  review: SignTransactionReview,
): string => {
  const commandLines = review.commands.flatMap((command) => [
    `  ${command.index + 1}. ${command.kind}: ${command.summary}`,
    ...formatFactLines(command.details),
    ...command.warnings.map((warning) => `    Warning: ${warning}`),
  ]);

  const inputLines = review.inputs.flatMap((input) => [
    `  ${input.index}. ${input.kind}: ${input.summary}`,
    ...formatFactLines(input.details),
  ]);

  const gasLines = [
    `  Owner: ${review.gas.owner}`,
    `  Budget: ${review.gas.budget}`,
    `  Price: ${review.gas.price}`,
    ...review.gas.payments.flatMap((payment, index) => [
      `  Payment ${index + 1}: ${payment.objectId}`,
      `    Version: ${payment.version}`,
      `    Digest: ${payment.digest}`,
    ]),
  ];

  const balanceLines = review.dryRun.balanceChanges.map(
    (change) => `  ${change.index + 1}. ${change.summary}`,
  );

  const objectLines = review.dryRun.objectChanges.flatMap((change) => [
    `  ${change.index + 1}. ${change.summary}`,
    ...formatFactLines(change.details),
  ]);

  const eventLines = review.dryRun.events.flatMap((event) => [
    `  ${event.index + 1}. ${event.summary}`,
    ...formatFactLines(event.details),
  ]);

  const warningLines = review.warnings.map((warning) => `  ${warning}`);

  return [
    'Review QR transaction',
    '',
    `Network: ${review.network}`,
    `Sender: ${review.sender}`,
    `Sponsored: ${review.sponsored ? 'yes' : 'no'}`,
    ...(review.digest ? [`Host-provided digest: ${review.digest}`] : []),
    '',
    ...formatSection('Gas', gasLines),
    '',
    ...formatSection('Commands', commandLines),
    '',
    ...formatSection('Inputs', inputLines),
    '',
    `Dry run: ${review.dryRun.status}`,
    ...formatSection('Balance changes', balanceLines),
    '',
    ...formatSection('Object changes', objectLines),
    '',
    ...formatSection('Events', eventLines),
    ...(warningLines.length > 0
      ? ['', ...formatSection('Warnings', warningLines)]
      : []),
    '',
    'Approve signing this transaction?',
  ].join('\n');
};
