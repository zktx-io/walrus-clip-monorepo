// Walrus Clip SuiGrpc transport viability harness.
//
// This script does not change runtime behavior. It exists outside the
// Sui client owner boundary (scripts/ is excluded from verify-boundary.mjs
// scans) so it can probe SuiGrpcClient without violating the
// F-SUI-CLIENT-CREATION-SPREAD boundary rule. The goal is to record
// evidence that the current owner-boundary SuiGrpcClient transport still
// constructs, identifies chains, and returns effects.bcs across supported
// networks. It is a regression harness, not product runtime.
//
// Outputs:
//   stderr: human-readable per-network status
//   stdout: a single JSON document describing the probe result
// Options:
//   --output=<path> writes the same JSON document to disk
//   --digest=<digest> --digest-network=<network> probes one known digest
//   --base-url-<network>=<url> overrides one endpoint for local failure tests
// Exit codes:
//   0  every probed check passed
//   1  one or more probed checks failed
//   2  every network failed identically (likely environment/network blocked)

import { SuiGrpcClient } from '@mysten/sui/grpc';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const NETWORKS = ['mainnet', 'testnet', 'devnet'];

// Source: .WORK/ts-sdks/packages/sui/README.md:75-81
const DEFAULT_BASE_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

const ErrorCategory = Object.freeze({
  ApiShapeMismatch: 'api-shape-mismatch',
  EndpointUnreachable: 'endpoint-unreachable',
  Skipped: 'skipped',
  Timeout: 'timeout',
  TransportError: 'transport-error',
  Unknown: 'unknown',
});

const ERROR_CLASSIFIER_TOKEN_TABLE = Object.freeze({
  [ErrorCategory.Timeout]: ['AbortError', 'ETIMEDOUT', 'timeout'],
  [ErrorCategory.EndpointUnreachable]: [
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'UND_ERR',
    'fetch failed',
    'network error',
    'getaddrinfo',
  ],
  [ErrorCategory.TransportError]: ['http'],
});

const parseArgs = (argv) => {
  const result = {
    baseUrls: {},
    digest: null,
    digestNetwork: null,
    output: null,
  };
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'digest') result.digest = value;
    if (key === 'digest-network') result.digestNetwork = value;
    if (key === 'output') result.output = value;
    const baseUrlMatch = key.match(/^base-url-(mainnet|testnet|devnet)$/);
    if (baseUrlMatch) result.baseUrls[baseUrlMatch[1]] = value;
  }
  if (!result.digest && process.env.SUI_GRPC_PROBE_DIGEST) {
    result.digest = process.env.SUI_GRPC_PROBE_DIGEST;
  }
  if (!result.digestNetwork && process.env.SUI_GRPC_PROBE_DIGEST_NETWORK) {
    result.digestNetwork = process.env.SUI_GRPC_PROBE_DIGEST_NETWORK;
  }
  for (const network of NETWORKS) {
    const envKey = `SUI_GRPC_PROBE_${network.toUpperCase()}_BASE_URL`;
    if (!result.baseUrls[network] && process.env[envKey]) {
      result.baseUrls[network] = process.env[envKey];
    }
  }
  return result;
};

const elapsedMs = (startedAt) => Math.max(0, Date.now() - startedAt);

const matchesClassifierTokens = (category, ...candidates) => {
  const tokens = ERROR_CLASSIFIER_TOKEN_TABLE[category] ?? [];
  return candidates.some((value) => {
    if (!value) return false;
    const candidate = String(value).toLowerCase();
    return tokens.some((token) =>
      candidate.includes(String(token).toLowerCase()),
    );
  });
};

const classifyError = (err) => {
  if (!err) return { category: ErrorCategory.Unknown, message: 'no error object' };
  const message = err && err.message ? String(err.message) : String(err);
  const code = err && err.code ? String(err.code) : null;
  const cause = err && err.cause ? err.cause : null;
  const causeCode = cause && cause.code ? String(cause.code) : null;
  const causeMessage = cause && cause.message ? String(cause.message) : null;

  if (
    err.name === 'AbortError' ||
    matchesClassifierTokens(
      ErrorCategory.Timeout,
      err.name,
      message,
      code,
      causeMessage,
      causeCode,
    )
  ) {
    return { category: ErrorCategory.Timeout, message, code, causeCode };
  }

  if (
    matchesClassifierTokens(
      ErrorCategory.EndpointUnreachable,
      message,
      code,
      causeMessage,
      causeCode,
    )
  ) {
    return {
      category: ErrorCategory.EndpointUnreachable,
      message,
      code,
      causeCode,
    };
  }

  if (matchesClassifierTokens(ErrorCategory.TransportError, message)) {
    return { category: ErrorCategory.TransportError, message, code };
  }

  return { category: ErrorCategory.Unknown, message, code };
};

const assertClassifierSelfCheck = () => {
  const cases = [
    {
      label: 'abort',
      error: { name: 'AbortError', message: 'operation aborted' },
      category: ErrorCategory.Timeout,
    },
    {
      label: 'fetch failed',
      error: { message: 'fetch failed', code: 'INTERNAL' },
      category: ErrorCategory.EndpointUnreachable,
    },
    {
      label: 'http status',
      error: { message: 'HTTP status 503' },
      category: ErrorCategory.TransportError,
    },
    {
      label: 'unknown',
      error: { message: 'shape changed' },
      category: ErrorCategory.Unknown,
    },
  ];
  const misses = cases.filter(
    ({ error, category }) => classifyError(error).category !== category,
  );
  if (misses.length > 0) {
    throw new Error(
      `error classifier self-check failed: ${misses
        .map(({ label }) => label)
        .join(', ')}`,
    );
  }
};

const baseUrlFor = (network, baseUrls) =>
  baseUrls[network] ?? DEFAULT_BASE_URLS[network];

const probeConstruct = (network, baseUrl) => {
  const startedAt = Date.now();
  try {
    const client = new SuiGrpcClient({ network, baseUrl });
    return { ok: true, baseUrl, client, durationMs: elapsedMs(startedAt) };
  } catch (err) {
    return {
      ok: false,
      baseUrl,
      client: null,
      error: classifyError(err),
      durationMs: elapsedMs(startedAt),
    };
  }
};

const probeChainIdentifier = async (client) => {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const result = await client.core.getChainIdentifier({
        signal: controller.signal,
      });
      if (!result || typeof result.chainIdentifier !== 'string') {
        return {
          ok: false,
          error: {
            category: ErrorCategory.ApiShapeMismatch,
            message:
              'getChainIdentifier response missing chainIdentifier string',
          },
          durationMs: elapsedMs(startedAt),
        };
      }
      return {
        ok: true,
        chainIdentifier: result.chainIdentifier,
        durationMs: elapsedMs(startedAt),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return {
      ok: false,
      error: classifyError(err),
      durationMs: elapsedMs(startedAt),
    };
  }
};

// findRecentDigest reaches into the raw gRPC service surface
// (client.ledgerService.{getServiceInfo, getCheckpoint}) because the SDK 2.x
// unified Core API does not expose a "find a recent finalized digest"
// primitive. This direct service-level use is intentional and contained to the
// viability proof gate: it lets the harness self-discover a finalized digest
// per network so the effects.bcs probe does not require manual digest input.
//
// IMPORTANT: this pattern must not be copied into product runtime path.
// The wallet and private-route owner files
// (packages/walrus-wallet/src/utils/suiClient.ts,
// packages/walrus-connect-route-internal/src/utils/suiClient.ts) must continue
// to consume only `client.core.*` methods so the owner contract stays
// transport-agnostic.
const findRecentDigest = async (client) => {
  const info = await client.ledgerService.getServiceInfo({});
  const heightRaw =
    info && info.response ? info.response.checkpointHeight : undefined;
  if (heightRaw === undefined || heightRaw === null) {
    throw new Error(
      'ledgerService.getServiceInfo did not return checkpointHeight',
    );
  }
  const height =
    typeof heightRaw === 'bigint' ? heightRaw : BigInt(heightRaw);

  for (let offset = 0n; offset < 8n; offset += 1n) {
    const sequenceNumber = height - offset;
    if (sequenceNumber < 0n) break;
    const cp = await client.ledgerService.getCheckpoint({
      checkpointId: {
        oneofKind: 'sequenceNumber',
        sequenceNumber,
      },
      readMask: { paths: ['transactions.digest'] },
    });
    const transactions =
      (cp && cp.response && cp.response.checkpoint
        ? cp.response.checkpoint.transactions
        : null) ?? [];
    for (const tx of transactions) {
      if (tx && typeof tx.digest === 'string' && tx.digest.length > 0) {
        return {
          digest: tx.digest,
          checkpointSequence: sequenceNumber.toString(),
        };
      }
    }
  }
  throw new Error(
    'no transaction digest found in 8 most recent checkpoints (empty range)',
  );
};

const probeEffectsBcs = async (client, digest) => {
  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const result = await client.core.waitForTransaction({
        digest,
        include: { effects: true },
        timeout: 25_000,
        signal: controller.signal,
      });
      const transaction =
        result.$kind === 'Transaction'
          ? result.Transaction
          : result.FailedTransaction;
      const bcs = transaction && transaction.effects && transaction.effects.bcs;
      if (!bcs) {
        return {
          ok: false,
          kind: result.$kind,
          digest,
          error: {
            category: ErrorCategory.ApiShapeMismatch,
            message:
              'waitForTransaction returned no effects.bcs even though include.effects was requested',
          },
          durationMs: elapsedMs(startedAt),
        };
      }
      return {
        ok: true,
        kind: result.$kind,
        digest,
        effectsBcsByteLength: bcs.byteLength,
        durationMs: elapsedMs(startedAt),
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return {
      ok: false,
      digest,
      error: classifyError(err),
      durationMs: elapsedMs(startedAt),
    };
  }
};

const writeJsonOutput = (outputPath, json) => {
  if (!outputPath) return;
  const resolved = path.resolve(outputPath);
  mkdirSync(path.dirname(resolved), { recursive: true });
  writeFileSync(resolved, `${json}\n`);
};

const main = async () => {
  assertClassifierSelfCheck();

  const startedAt = Date.now();
  const { baseUrls, digest, digestNetwork, output } = parseArgs(
    process.argv.slice(2),
  );

  const networkResults = {};
  let allBlocked = true;
  let firstCategory = null;
  let categoriesAllMatch = true;
  let anyFailure = false;

  const recordFailureCategory = (category) => {
    anyFailure = true;
    if (firstCategory === null) firstCategory = category;
    else if (firstCategory !== category) categoriesAllMatch = false;
    if (
      category !== ErrorCategory.EndpointUnreachable &&
      category !== ErrorCategory.Timeout
    ) {
      allBlocked = false;
    }
  };

  const recordSuccess = () => {
    allBlocked = false;
    categoriesAllMatch = false;
  };

  const probeBaselineNetwork = async (network) => {
    const construct = probeConstruct(network, baseUrlFor(network, baseUrls));
    if (!construct.ok) {
      return {
        failureCategory: construct.error?.category ?? ErrorCategory.Unknown,
        network,
        row: {
          baseUrl: construct.baseUrl,
          construct: {
            ok: false,
            error: construct.error,
            durationMs: construct.durationMs,
          },
          chainIdentifier: {
            ok: false,
            error: { category: ErrorCategory.Skipped },
            durationMs: 0,
          },
        },
      };
    }

    const chain = await probeChainIdentifier(construct.client);
    return {
      failureCategory: chain.ok
        ? null
        : chain.error?.category ?? ErrorCategory.Unknown,
      network,
      row: {
        baseUrl: construct.baseUrl,
        construct: { ok: true, durationMs: construct.durationMs },
        chainIdentifier: chain,
      },
    };
  };

  const baselineResults = await Promise.all(
    NETWORKS.map((network) => probeBaselineNetwork(network)),
  );
  for (const { failureCategory, network, row } of baselineResults) {
    networkResults[network] = row;
    if (failureCategory) recordFailureCategory(failureCategory);
    else recordSuccess();
  }

  const effectsBcs = { mode: null, perNetwork: {} };

  const baselineOkFor = (network) => {
    const row = networkResults[network];
    return Boolean(row && row.construct.ok && row.chainIdentifier.ok);
  };

  const skippedAutoProbe = (network) => ({
    tested: false,
    source: 'auto',
    network,
    reason:
      'baseline construct/chainIdentifier did not succeed; effects.bcs probe skipped',
    durationMs: 0,
  });

  const autoProbeNetwork = async (network) => {
    const startedAt = Date.now();
    const construct = probeConstruct(network, baseUrlFor(network, baseUrls));
    if (!construct.ok) {
      return {
        tested: false,
        source: 'auto',
        network,
        reason:
          'auto-probe could not re-construct SuiGrpcClient even after baseline succeeded',
        error: construct.error,
        durationMs: elapsedMs(startedAt),
      };
    }
    try {
      const found = await findRecentDigest(construct.client);
      const probe = await probeEffectsBcs(construct.client, found.digest);
      return {
        tested: true,
        source: 'auto',
        network,
        checkpointSequence: found.checkpointSequence,
        ...probe,
        durationMs: elapsedMs(startedAt),
      };
    } catch (err) {
      return {
        tested: false,
        source: 'auto',
        network,
        reason:
          'auto-probe could not discover a recent finalized digest via ledgerService.getCheckpoint',
        error: classifyError(err),
        durationMs: elapsedMs(startedAt),
      };
    }
  };

  // Manual digest mode is intentionally retained for transport regressions:
  // when a specific finalized digest reproduces a SuiGrpcClient wait/finality
  // issue, pass `--digest=<digest> --digest-network=<network>` to probe that
  // exact transaction instead of relying on the auto-discovered recent digest.
  if (digest && digestNetwork) {
    effectsBcs.mode = 'manual';
    if (!NETWORKS.includes(digestNetwork)) {
      for (const network of NETWORKS) {
        effectsBcs.perNetwork[network] = {
          tested: false,
          source: 'manual',
          network,
          reason: `digest-network must be one of ${NETWORKS.join('/')}, got ${digestNetwork}`,
          durationMs: 0,
        };
      }
      anyFailure = true;
    } else {
      for (const network of NETWORKS) {
        if (network !== digestNetwork) {
          effectsBcs.perNetwork[network] = {
            tested: false,
            source: 'manual',
            network,
            reason: `manual digest probe is scoped to ${digestNetwork}; rerun without --digest for auto-probe across networks`,
            durationMs: 0,
          };
          continue;
        }
        const startedAt = Date.now();
        const construct = probeConstruct(network, baseUrlFor(network, baseUrls));
        if (!construct.ok) {
          effectsBcs.perNetwork[network] = {
            tested: false,
            source: 'manual',
            network,
            digest,
            reason:
              'cannot reuse SuiGrpcClient construction for manual effects probe',
            error: construct.error,
            durationMs: elapsedMs(startedAt),
          };
          anyFailure = true;
        } else {
          const probe = await probeEffectsBcs(construct.client, digest);
          effectsBcs.perNetwork[network] = {
            tested: true,
            source: 'manual',
            network,
            ...probe,
            durationMs: elapsedMs(startedAt),
          };
          if (!probe.ok) anyFailure = true;
        }
      }
    }
  } else {
    effectsBcs.mode = 'auto';
    const autoProbeResults = await Promise.all(
      NETWORKS.map((network) =>
        baselineOkFor(network)
          ? autoProbeNetwork(network)
          : skippedAutoProbe(network),
      ),
    );
    for (const result of autoProbeResults) {
      const { network } = result;
      effectsBcs.perNetwork[network] = result;
      if (result.tested === false) {
        anyFailure = true;
      } else if (result.ok === false) {
        anyFailure = true;
      }
    }
  }

  const summary = {
    schemaVersion: 3,
    timestamp: new Date().toISOString(),
    sdkSource: '@mysten/sui/grpc (SuiGrpcClient + GrpcWebFetchTransport)',
    networks: networkResults,
    effectsBcs,
    totalDurationMs: elapsedMs(startedAt),
  };

  const json = JSON.stringify(summary, null, 2);
  writeJsonOutput(output, json);
  process.stdout.write(json + '\n');

  for (const network of NETWORKS) {
    const row = networkResults[network];
    const construct = row.construct.ok ? 'ok' : `fail(${row.construct.error?.category ?? 'unknown'})`;
    const chain = row.chainIdentifier.ok
      ? `ok chain=${row.chainIdentifier.chainIdentifier}`
      : `fail(${row.chainIdentifier.error?.category ?? 'unknown'})`;
    process.stderr.write(
      `[${network}] baseUrl=${row.baseUrl} construct=${construct} chainIdentifier=${chain}\n`,
    );
  }
  for (const network of NETWORKS) {
    const e = effectsBcs.perNetwork[network];
    if (!e) {
      process.stderr.write(
        `[effects.bcs ${network}] not tested: no result recorded\n`,
      );
      continue;
    }
    if (e.tested && e.ok) {
      const cp = e.checkpointSequence ? ` checkpoint=${e.checkpointSequence}` : '';
      process.stderr.write(
        `[effects.bcs ${network}] source=${e.source} digest=${e.digest}${cp} kind=${e.kind} bytes=${e.effectsBcsByteLength}\n`,
      );
    } else if (e.tested && !e.ok) {
      process.stderr.write(
        `[effects.bcs ${network}] source=${e.source} digest=${e.digest ?? '-'} failed(${e.error?.category ?? 'unknown'}): ${e.error?.message ?? ''}\n`,
      );
    } else {
      process.stderr.write(
        `[effects.bcs ${network}] not tested (${e.source ?? 'auto'}): ${e.reason ?? ''}\n`,
      );
    }
  }

  if (!anyFailure) {
    process.exit(0);
  }
  if (
    allBlocked &&
    categoriesAllMatch &&
    (firstCategory === ErrorCategory.EndpointUnreachable ||
      firstCategory === ErrorCategory.Timeout)
  ) {
    process.exit(2);
  }
  process.exit(1);
};

main().catch((err) => {
  process.stderr.write(`harness crashed: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
