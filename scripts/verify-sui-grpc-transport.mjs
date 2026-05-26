// Walrus Clip SuiGrpc transport viability harness.
//
// This script does not change runtime behavior. It exists outside the
// Sui client owner boundary (scripts/ is excluded from verify-boundary.mjs
// scans) so it can probe SuiGrpcClient without violating the
// F-SUI-CLIENT-CREATION-SPREAD boundary rule. The goal is to record
// evidence for whether transport migration from SuiJsonRpcClient to
// SuiGrpcClient is viable; it is not the migration itself.
//
// Outputs:
//   stderr: human-readable per-network status
//   stdout: a single JSON document describing the probe result
// Exit codes:
//   0  every probed check passed
//   1  one or more probed checks failed
//   2  every network failed identically (likely environment/network blocked)

import { SuiGrpcClient } from '@mysten/sui/grpc';

const NETWORKS = ['mainnet', 'testnet', 'devnet'];

// Source: .WORK/ts-sdks/packages/sui/README.md:75-81
const DEFAULT_BASE_URLS = {
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  testnet: 'https://fullnode.testnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};

const parseArgs = (argv) => {
  const result = { digest: null, digestNetwork: null };
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'digest') result.digest = value;
    if (key === 'digest-network') result.digestNetwork = value;
  }
  if (!result.digest && process.env.SUI_GRPC_PROBE_DIGEST) {
    result.digest = process.env.SUI_GRPC_PROBE_DIGEST;
  }
  if (!result.digestNetwork && process.env.SUI_GRPC_PROBE_DIGEST_NETWORK) {
    result.digestNetwork = process.env.SUI_GRPC_PROBE_DIGEST_NETWORK;
  }
  return result;
};

const classifyError = (err) => {
  if (!err) return { category: 'unknown', message: 'no error object' };
  const message = err && err.message ? String(err.message) : String(err);
  const code = err && err.code ? String(err.code) : null;
  const cause = err && err.cause ? err.cause : null;
  const causeCode = cause && cause.code ? String(cause.code) : null;
  const causeMessage = cause && cause.message ? String(cause.message) : null;

  const networkTokens = [
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'EAI_AGAIN',
    'EHOSTUNREACH',
    'ETIMEDOUT',
    'UND_ERR',
    'fetch failed',
    'network error',
    'getaddrinfo',
  ];

  const matchesNetwork = (...candidates) =>
    candidates.some((value) =>
      value
        ? networkTokens.some((token) => value.includes(token))
        : false,
    );

  if (
    matchesNetwork(message, code, causeMessage, causeCode) ||
    err.name === 'AbortError'
  ) {
    if (err.name === 'AbortError' || (message && message.includes('timeout'))) {
      return { category: 'timeout', message, code, causeCode };
    }
    return { category: 'endpoint-unreachable', message, code, causeCode };
  }

  if (message.toLowerCase().includes('http')) {
    return { category: 'transport-error', message, code };
  }

  return { category: 'unknown', message, code };
};

const probeConstruct = (network) => {
  const baseUrl = DEFAULT_BASE_URLS[network];
  try {
    const client = new SuiGrpcClient({ network, baseUrl });
    return { ok: true, baseUrl, client };
  } catch (err) {
    return {
      ok: false,
      baseUrl,
      client: null,
      error: classifyError(err),
    };
  }
};

const probeChainIdentifier = async (client) => {
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
            category: 'api-shape-mismatch',
            message:
              'getChainIdentifier response missing chainIdentifier string',
          },
        };
      }
      return { ok: true, chainIdentifier: result.chainIdentifier };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return { ok: false, error: classifyError(err) };
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
            category: 'api-shape-mismatch',
            message:
              'waitForTransaction returned no effects.bcs even though include.effects was requested',
          },
        };
      }
      return {
        ok: true,
        kind: result.$kind,
        digest,
        effectsBcsByteLength: bcs.byteLength,
      };
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return { ok: false, digest, error: classifyError(err) };
  }
};

const main = async () => {
  const { digest, digestNetwork } = parseArgs(process.argv.slice(2));

  const networkResults = {};
  let allBlocked = true;
  let firstCategory = null;
  let categoriesAllMatch = true;
  let anyFailure = false;

  for (const network of NETWORKS) {
    const construct = probeConstruct(network);
    if (!construct.ok) {
      networkResults[network] = {
        baseUrl: construct.baseUrl,
        construct: { ok: false, error: construct.error },
        chainIdentifier: { ok: false, error: { category: 'skipped' } },
      };
      anyFailure = true;
      const cat = construct.error?.category ?? 'unknown';
      if (firstCategory === null) firstCategory = cat;
      else if (firstCategory !== cat) categoriesAllMatch = false;
      if (cat !== 'endpoint-unreachable' && cat !== 'timeout')
        allBlocked = false;
      continue;
    }

    const chain = await probeChainIdentifier(construct.client);
    networkResults[network] = {
      baseUrl: construct.baseUrl,
      construct: { ok: true },
      chainIdentifier: chain,
    };
    if (!chain.ok) {
      anyFailure = true;
      const cat = chain.error?.category ?? 'unknown';
      if (firstCategory === null) firstCategory = cat;
      else if (firstCategory !== cat) categoriesAllMatch = false;
      if (cat !== 'endpoint-unreachable' && cat !== 'timeout')
        allBlocked = false;
    } else {
      allBlocked = false;
      categoriesAllMatch = false;
    }
  }

  const effectsBcs = { mode: null, perNetwork: {} };

  const baselineOkFor = (network) => {
    const row = networkResults[network];
    return Boolean(row && row.construct.ok && row.chainIdentifier.ok);
  };

  const autoProbeNetwork = async (network) => {
    if (!baselineOkFor(network)) {
      return {
        tested: false,
        source: 'auto',
        network,
        reason:
          'baseline construct/chainIdentifier did not succeed; effects.bcs probe skipped',
      };
    }
    const construct = probeConstruct(network);
    if (!construct.ok) {
      return {
        tested: false,
        source: 'auto',
        network,
        reason:
          'auto-probe could not re-construct SuiGrpcClient even after baseline succeeded',
        error: construct.error,
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
      };
    } catch (err) {
      return {
        tested: false,
        source: 'auto',
        network,
        reason:
          'auto-probe could not discover a recent finalized digest via ledgerService.getCheckpoint',
        error: classifyError(err),
      };
    }
  };

  if (digest && digestNetwork) {
    effectsBcs.mode = 'manual';
    if (!NETWORKS.includes(digestNetwork)) {
      for (const network of NETWORKS) {
        effectsBcs.perNetwork[network] = {
          tested: false,
          source: 'manual',
          network,
          reason: `digest-network must be one of ${NETWORKS.join('/')}, got ${digestNetwork}`,
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
          };
          continue;
        }
        const construct = probeConstruct(network);
        if (!construct.ok) {
          effectsBcs.perNetwork[network] = {
            tested: false,
            source: 'manual',
            network,
            digest,
            reason:
              'cannot reuse SuiGrpcClient construction for manual effects probe',
            error: construct.error,
          };
          anyFailure = true;
        } else {
          const probe = await probeEffectsBcs(construct.client, digest);
          effectsBcs.perNetwork[network] = {
            tested: true,
            source: 'manual',
            network,
            ...probe,
          };
          if (!probe.ok) anyFailure = true;
        }
      }
    }
  } else {
    effectsBcs.mode = 'auto';
    for (const network of NETWORKS) {
      const result = await autoProbeNetwork(network);
      effectsBcs.perNetwork[network] = result;
      if (result.tested === false) {
        anyFailure = true;
      } else if (result.ok === false) {
        anyFailure = true;
      }
    }
  }

  const summary = {
    schemaVersion: 2,
    timestamp: new Date().toISOString(),
    sdkSource: '@mysten/sui/grpc (SuiGrpcClient + GrpcWebFetchTransport)',
    networks: networkResults,
    effectsBcs,
  };

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');

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
    (firstCategory === 'endpoint-unreachable' || firstCategory === 'timeout')
  ) {
    process.exit(2);
  }
  process.exit(1);
};

main().catch((err) => {
  process.stderr.write(`harness crashed: ${err && err.stack ? err.stack : err}\n`);
  process.exit(1);
});
