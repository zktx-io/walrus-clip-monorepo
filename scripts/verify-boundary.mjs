import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const mode = process.argv.includes('--completion') ? 'completion' : 'boundary';
const root = process.cwd();
const internalWorkspace = 'packages/walrus-connect-route-internal';
const internalPackage = '@zktx.io/walrus-connect-route-internal';

const failures = [];
const verifierChecks = new Set([
  'workspace-private-package',
  'public-export-map',
  'app-source-imports',
  'wallet-source-imports',
  'wallet-private-route-adapter',
  'connect-source-public-root',
  'signer-app-source-scan-only',
  'wallet-source-public-root',
  'internal-route-source-ownership',
  'signer-app-generated-dts',
  'connect-generated-dts-artifact',
  'connect-pack-artifact',
  'wallet-pack-artifact',
  'wallet-generated-dts-artifact',
  'wallet-generated-public-dts',
  'wallet-public-route-outcome-contract',
  'verifier-negative-controls',
  'boundary-inventory-mapping',
  'documentation-stale-outcomes',
  'sui-client-boundary-source',
  'sui-transaction-execution-boundary',
  'sui-public-type-surface',
  'completion-staged-snapshot',
  'completion-manual-smoke',
]);

const readText = (file) => readFileSync(path.join(root, file), 'utf8');
const readJson = (file) => JSON.parse(readText(file));
const pathExists = (file) => existsSync(path.join(root, file));

const fail = (message) => {
  failures.push(message);
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const assert = (condition, message) => {
  if (!condition) {
    fail(message);
  }
};

const matchesPattern = (pattern, value) => {
  pattern.lastIndex = 0;
  return pattern.test(value);
};

const listFiles = (dir) => {
  if (!existsSync(path.join(root, dir))) {
    return [];
  }

  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', dir], {
    cwd: root,
    encoding: 'utf8',
  });

  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => /\.(?:ts|tsx|js|jsx|mjs|cjs|md|json)$/.test(file))
    .filter(pathExists);
};

const listGeneratedDeclarationFiles = (dir) => {
  const absoluteDir = path.join(root, dir);
  if (!existsSync(absoluteDir)) return [];

  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const absoluteEntry = path.join(current, entry);
      const relativeEntry = relativeFromRoot(absoluteEntry);
      const stat = statSync(absoluteEntry);
      if (stat.isDirectory()) {
        visit(absoluteEntry);
      } else if (relativeEntry.endsWith('.d.ts')) {
        files.push(relativeEntry);
      }
    }
  };

  visit(absoluteDir);
  return files.sort();
};

const scanFiles = (files, pattern) => {
  const matches = [];

  for (const file of files) {
    const text = readText(file);
    const lines = text.split('\n');

    lines.forEach((line, index) => {
      if (matchesPattern(pattern, line)) {
        matches.push(`${file}:${index + 1}: ${line.trim()}`);
      }
    });
  }

  return matches;
};

const relativeFromRoot = (absolutePath) =>
  path.relative(root, absolutePath).split(path.sep).join('/');

const declarationSpecifiers = (text) => {
  const specifiers = [];
  const patterns = [
    /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) {
      specifiers.push(match[1]);
    }
  }

  return specifiers;
};

const resolveDeclarationSpecifier = (fromFile, specifier) => {
  if (!specifier.startsWith('.')) return undefined;

  const fromDir = path.dirname(path.join(root, fromFile));
  const resolved = path.resolve(fromDir, specifier);
  const candidates = [
    `${resolved}.d.ts`,
    path.join(resolved, 'index.d.ts'),
    resolved,
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return relativeFromRoot(candidate);
  }

  return undefined;
};

const collectDeclarationGraph = (entryFile) => {
  if (!pathExists(entryFile)) return [];

  const seen = new Set();
  const pending = [entryFile];

  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || seen.has(file)) continue;
    seen.add(file);

    for (const specifier of declarationSpecifiers(readText(file))) {
      const resolved = resolveDeclarationSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) pending.push(resolved);
    }
  }

  return [...seen].sort();
};

const scanGeneratedDeclarationGraph = (entryFile, forbiddenPatterns) => {
  const files = collectDeclarationGraph(entryFile);
  const matches = [];

  for (const file of files) {
    const text = readText(file);
    const lines = text.split('\n');
    for (const { label, pattern } of forbiddenPatterns) {
      lines.forEach((line, index) => {
        if (matchesPattern(pattern, line)) {
          matches.push(`${file}:${index + 1}: ${label}: ${line.trim()}`);
        }
      });
    }
  }

  return { files, matches };
};

const runNpmPackDryRun = (workspaceName) => {
  const output = execFileSync(
    'npm',
    ['pack', '--dry-run', '--workspace', workspaceName, '--json'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_config_cache: path.join(os.tmpdir(), 'walrus-clip-npm-cache'),
        npm_config_loglevel: 'silent',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const parsed = JSON.parse(output);
  const pack = Array.isArray(parsed) ? parsed[0] : parsed;
  return (pack?.files ?? []).map((file) => file.path).sort();
};

const forbiddenPackPaths = (files, rules) =>
  files.flatMap((file) =>
    rules
      .filter(({ pattern }) => matchesPattern(pattern, file))
      .map(({ label }) => `${label}: ${file}`),
  );

const suiClientConstructionPattern =
  /\b(?:new\s+SuiClient|new\s+SuiGraphQLClient|new\s+SuiGrpcClient|new\s+SuiJsonRpcClient|getFullnodeUrl\s*\(|getJsonRpcFullnodeUrl\s*\()/g;
const suiClientStaticRuntimeModulePattern =
  /\b(import|export)\s+(?!type\b)([^;]*?)\s+from\s+['"](@mysten\/sui\/(?:client|graphql|grpc|jsonRpc))['"]\s*;?/g;
const suiClientSideEffectImportPattern =
  /\bimport\s+['"](@mysten\/sui\/(?:client|graphql|grpc|jsonRpc))['"]\s*;?/g;
const suiClientDynamicRuntimeModulePattern =
  /\b(?:import|require)\s*\(\s*['"](@mysten\/sui\/(?:client|graphql|grpc|jsonRpc))['"]\s*\)/g;
const suiTransactionBoundaryNames =
  'executeTransactionBlock|executeTransaction|waitForTransaction|dryRunTransactionBlock|simulateTransaction|getLatestSuiSystemState|getDigest';
const suiTransactionBoundaryPattern =
  new RegExp(
    `(?:\\.\\s*(?:${suiTransactionBoundaryNames})\\s*(?:\\?\\.)?\\s*\\(|\\[\\s*['"](?:${suiTransactionBoundaryNames})['"]\\s*\\]\\s*(?:\\?\\.)?\\s*\\()`,
    'g',
  );
const suiTransactionBuildStartPattern =
  /(?:\.\s*build\s*(?:\?\.)?\s*\(|\[\s*['"]build['"]\s*\]\s*(?:\?\.)?\s*\()/g;
const publicReviewHelperFile =
  'packages/walrus-connect/src/utils/signTransactionReview.ts';
const publicSuiTypeSurfaceAllowlist = new Map([
  [
    'packages/walrus-connect/dist/types/types.d.ts',
    new Set([
      '@mysten/sui/cryptography',
      '@mysten/sui/transactions',
      '@mysten/wallet-standard',
    ]),
  ],
  [
    'packages/walrus-connect/dist/types/utils/signTransactionReview.d.ts',
    new Set(['@mysten/sui/jsonRpc', '@mysten/sui/transactions']),
  ],
  [
    'packages/walrus-wallet/dist/types/utils/coinHelpers.d.ts',
    new Set(['@mysten/sui/jsonRpc']),
  ],
  [
    'packages/walrus-wallet/dist/types/utils/publicSuiClient.d.ts',
    new Set(['@mysten/sui/jsonRpc']),
  ],
]);
const mystenPublicTypeSpecifierPattern =
  /^@mysten\/(?:sui(?:\/[^'"]+)?|wallet-standard|dapp-kit|dapp-kit-react|dapp-kit-core)$/;

const lineNumberForOffset = (text, offset) =>
  text.slice(0, offset).split('\n').length;

const isTypeOnlyNamedImport = (specifier) => {
  const trimmed = specifier.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return false;

  return trimmed
    .slice(1, -1)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .every((part) => part.startsWith('type '));
};

const scanSuiClientRuntimeEdges = (file, text = readText(file)) => {
  const matches = [];
  let match;

  suiClientStaticRuntimeModulePattern.lastIndex = 0;
  while ((match = suiClientStaticRuntimeModulePattern.exec(text))) {
    if (isTypeOnlyNamedImport(match[2])) continue;

    const snippet = match[0].replace(/\s+/g, ' ').trim();
    matches.push(
      `${file}:${lineNumberForOffset(text, match.index)}: ${snippet}`,
    );
  }

  for (const pattern of [
    suiClientSideEffectImportPattern,
    suiClientDynamicRuntimeModulePattern,
  ]) {
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      const snippet = match[0].replace(/\s+/g, ' ').trim();
      matches.push(
        `${file}:${lineNumberForOffset(text, match.index)}: ${snippet}`,
      );
    }
  }

  return matches;
};

const scanSuiTransactionBuildCalls = (file, text = readText(file)) => {
  const matches = [];
  let match;

  suiTransactionBuildStartPattern.lastIndex = 0;
  while ((match = suiTransactionBuildStartPattern.exec(text))) {
    const lineEnd = text.indexOf('\n', match.index);
    const snippet = text
      .slice(match.index, lineEnd === -1 ? text.length : lineEnd)
      .replace(/\s+/g, ' ')
      .trim();
    matches.push(
      `${file}:${lineNumberForOffset(text, match.index)}: ${snippet}`,
    );
  }

  return matches;
};

const isAllowedLine = (line, allowedFiles) =>
  [...allowedFiles].some((file) => line.startsWith(`${file}:`));

const isPublicReviewDryRunLine = (line) =>
  line.startsWith(`${publicReviewHelperFile}:`) &&
  /\.dryRunTransactionBlock\s*\(/.test(line);

const isAllowedSuiTransactionBoundaryLine = (line, allowedFiles) =>
  isAllowedLine(line, allowedFiles) || isPublicReviewDryRunLine(line);

const isAllowedPublicSuiTypeSurface = (file, specifier) =>
  publicSuiTypeSurfaceAllowlist.get(file)?.has(specifier) ?? false;

const checkVerifierNegativeControls = () => {
  const repeatedDeclarationMatches = ['QRSignOutcome', 'QRSignOutcome'].filter(
    (line) => matchesPattern(/\bQRSignOutcome\b/g, line),
  );
  assert(
    repeatedDeclarationMatches.length === 2,
    'verifier regex matching must catch repeated forbidden declaration lines',
  );

  const repeatedPackMatches = forbiddenPackPaths(
    ['dist/types/protocol/a.d.ts', 'dist/types/protocol/b.d.ts'],
    [{ label: 'route protocol declaration', pattern: /^dist\/types\/protocol\//g }],
  );
  assert(
    repeatedPackMatches.length === 2,
    'verifier pack matching must catch repeated forbidden artifact paths',
  );

  const repeatedSuiClientMatches = [
    'new SuiClient({ url })',
    'new SuiGraphQLClient({ url })',
    'new SuiGrpcClient({ transport })',
    'new SuiJsonRpcClient({ transport })',
    'getFullnodeUrl("mainnet")',
    'getJsonRpcFullnodeUrl("mainnet")',
  ].filter((line) => matchesPattern(suiClientConstructionPattern, line));
  assert(
    repeatedSuiClientMatches.length === 6,
    'verifier Sui client regex must catch direct current and SDK 2.x client/fullnode construction',
  );

  const repeatedSuiClientRuntimeImportMatches = scanSuiClientRuntimeEdges(
    'negative-control.ts',
    [
      "import { SuiClient as Client } from '@mysten/sui/client';",
      "import * as suiClient from '@mysten/sui/client';",
      "import '@mysten/sui/client';",
      "import { SuiGraphQLClient as GraphQL } from '@mysten/sui/graphql';",
      "import { SuiGrpcClient as Grpc } from '@mysten/sui/grpc';",
      "import { SuiJsonRpcClient as JsonRpc } from '@mysten/sui/jsonRpc';",
      "export { SuiClient } from '@mysten/sui/client';",
      "export * from '@mysten/sui/grpc';",
      "const jsonRpc = await import('@mysten/sui/jsonRpc');",
      "const client = require('@mysten/sui/client');",
      "import suiClient = require('@mysten/sui/client');",
      "import { type SuiClient } from '@mysten/sui/client';",
      "import { type SuiGrpcClient } from '@mysten/sui/grpc';",
      "import type { SuiClient } from '@mysten/sui/client';",
      "import type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';",
      "export { type SuiClient } from '@mysten/sui/client';",
      "export type { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';",
    ].join('\n'),
  );
  assert(
    repeatedSuiClientRuntimeImportMatches.length === 11,
    'verifier Sui client runtime edge scan must catch current and SDK 2.x imports, re-exports, dynamic imports, and require-style calls while allowing type-only imports',
  );

  const repeatedSuiTransactionMethodMatches = [
    'client.executeTransactionBlock({})',
    'client.executeTransactionBlock?.({})',
    'client["executeTransactionBlock"]({})',
    'client.executeTransaction({ transaction, signatures })',
    'client.waitForTransaction({ digest })',
    "client['waitForTransaction']({ digest })",
    'client.dryRunTransactionBlock({ transactionBlock: bytes })',
    'client.simulateTransaction({ transaction })',
    'client.simulateTransaction?.({ transaction })',
    'client.getLatestSuiSystemState()',
    'tx.getDigest({ client })',
    'tx["getDigest"]({ client })',
  ].filter((line) => matchesPattern(suiTransactionBoundaryPattern, line));
  assert(
    repeatedSuiTransactionMethodMatches.length === 12,
    'verifier Sui transaction regex must catch direct current and SDK 2.x execute/wait/dry-run/simulate/digest/system-state calls, including bracket and optional-call forms',
  );

  const repeatedSuiTransactionBuildMatches = scanSuiTransactionBuildCalls(
    'negative-control.ts',
    [
      'tx.build({ client })',
      'tx.build({ onlyTransactionKind: true, client })',
      'tx.build({',
      '  onlyTransactionKind: true,',
      '  client,',
      '})',
      'tx.build()',
      'tx.build?.({ client })',
      'tx["build"]({ client })',
    ].join('\n'),
  );
  assert(
    repeatedSuiTransactionBuildMatches.length === 6,
    'verifier Sui transaction build scan must catch direct build calls regardless of options shape, line breaks, bracket access, or optional-call form',
  );

  assert(
    isPublicReviewDryRunLine(
      `${publicReviewHelperFile}:825: dryRun = await client.dryRunTransactionBlock({ transactionBlock: bytes });`,
    ),
    'public review helper exception must allow only the inventoried dry-run call',
  );
  assert(
    !isPublicReviewDryRunLine(
      `${publicReviewHelperFile}:1: await client.executeTransactionBlock({ transactionBlock: bytes, signature });`,
    ),
    'public review helper exception must not allow execute/wait/build calls',
  );
  assert(
    !isPublicReviewDryRunLine(
      `${publicReviewHelperFile}:1: await client.simulateTransaction({ transaction });`,
    ),
    'public review helper exception must not allow SDK 2.x simulate calls',
  );
  assert(
    !isPublicReviewDryRunLine(
      `${publicReviewHelperFile}:1: await transaction.getDigest({ client });`,
    ),
    'public review helper exception must not allow direct digest calls',
  );
  assert(
    isAllowedPublicSuiTypeSurface(
      'packages/walrus-connect/dist/types/types.d.ts',
      '@mysten/sui/transactions',
    ),
    'verifier public Sui type surface allowlist must allow inventoried public signer-app transaction types',
  );
  assert(
    !isAllowedPublicSuiTypeSurface(
      'packages/walrus-connect/dist/types/index.d.ts',
      '@mysten/sui/client',
    ),
    'verifier public Sui type surface allowlist must reject uninventoried public client type exposure',
  );
};

const checkWorkspacePackage = () => {
  const rootPackage = readJson('package.json');
  const lockfile = readJson('package-lock.json');
  const internalPkg = readJson(`${internalWorkspace}/package.json`);
  const walletPkg = readJson('packages/walrus-wallet/package.json');

  assert(
    rootPackage.workspaces?.includes(internalWorkspace),
    `root package.json workspaces must include ${internalWorkspace}`,
  );
  assert(
    lockfile.packages?.['']?.workspaces?.includes(internalWorkspace),
    `package-lock.json root workspaces must include ${internalWorkspace}`,
  );
  assert(internalPkg.name === internalPackage, `${internalWorkspace}/package.json has the wrong package name`);
  assert(internalPkg.private === true, `${internalPackage} must remain private`);
  assert(
    walletPkg.devDependencies?.[internalPackage] === 'file:../walrus-connect-route-internal',
    `walrus-wallet must depend on ${internalPackage} through the private workspace file path`,
  );
};

const checkPublicExports = () => {
  const connectPkg = readJson('packages/walrus-connect/package.json');
  const walletPkg = readJson('packages/walrus-wallet/package.json');

  const connectExports = connectPkg.exports ?? {};
  const walletExports = walletPkg.exports ?? {};

  assert(connectExports['.'], 'walrus-connect root export must be explicit');
  assert(connectExports['./signer-app'], 'walrus-connect must expose the signer-app subpath');
  assert(!connectExports['./wallet-route'], 'walrus-connect must not expose the wallet-route subpath');
  assert(!connectExports['./protocol'], 'walrus-connect must not expose low-level protocol subpaths');
  assert(walletExports['.'], 'walrus-wallet root export must be explicit');
  assert(!walletExports['./wallet-route'], 'walrus-wallet must not expose route internals');
};

const checkImports = () => {
  const appFiles = [...listFiles('packages/clip/src'), ...listFiles('packages/demo/src')];
  const walletFiles = listFiles('packages/walrus-wallet/src');

  const forbiddenAppImports = scanFiles(
    appFiles,
    /from ['"]@zktx\.io\/walrus-connect(?:['"]|\/(?!signer-app\b)[^'"]+['"])/,
  );
  assert(
    forbiddenAppImports.length === 0,
    `clip/demo must not import walrus-connect route internals:\n${forbiddenAppImports.join('\n')}`,
  );

  const forbiddenWalletImports = scanFiles(
    walletFiles,
    /from ['"]@zktx\.io\/walrus-connect(?:['"]|\/wallet-route['"])/,
  );
  assert(
    forbiddenWalletImports.length === 0,
    `walrus-wallet must not import public walrus-connect route surfaces:\n${forbiddenWalletImports.join('\n')}`,
  );

  const internalRouteImports = scanFiles(walletFiles, new RegExp(`from ['"]${escapeRegExp(internalPackage)}['"]`));
  const unexpectedInternalImports = internalRouteImports.filter(
    (line) => !line.startsWith('packages/walrus-wallet/src/internal/walrusConnectRoute.ts:'),
  );
  assert(
    unexpectedInternalImports.length === 0,
    `${internalPackage} imports must stay behind walrus-wallet/src/internal/walrusConnectRoute.ts:\n${unexpectedInternalImports.join('\n')}`,
  );
};

const checkSourceSurfaces = () => {
  const connectRoot = readText('packages/walrus-connect/src/index.tsx');
  const signerApp = readText('packages/walrus-connect/src/signer-app.ts');
  const walletRoot = readText('packages/walrus-wallet/src/index.tsx');

  const rootForbidden = [
    'QRLogin',
    'QRSign',
    'WalrusScan',
    'useWalrusScan',
    'openSignTxModal',
    'createSponsoredTransaction',
    'executeSponsoredTransaction',
    'QRSignOutcome',
    'LoginHostOutcome',
    'QRSignOutcomeError',
    'LoginHostOutcomeError',
  ];

  for (const name of rootForbidden) {
    assert(!new RegExp(`\\b${name}\\b`).test(connectRoot), `walrus-connect root source must not expose ${name}`);
  }

  for (const name of ['openSignTxModal', 'useWalrusScan', 'QRSignOutcomeError', 'LoginHostOutcomeError']) {
    assert(!new RegExp(`\\b${name}\\b`).test(signerApp), `signer-app source must not expose ${name}`);
  }

  for (const name of ['QRSignOutcomeError', 'LoginHostOutcomeError']) {
    assert(!new RegExp(`\\b${name}\\b`).test(walletRoot), `walrus-wallet public source must not expose ${name}`);
  }

  for (const name of ['WalrusWalletQrRouteOutcome', 'WalrusWalletLoginRouteOutcome']) {
    assert(!new RegExp(`\\b${name}\\b`).test(walletRoot), `walrus-wallet public source must not expose route lifecycle type ${name}`);
  }
};

const checkInternalRouteSourceOwnership = () => {
  const files = listFiles(internalWorkspace);
  const forbiddenSiblingSourceImports = scanFiles(
    files,
    /(?:from\s+['"]|import\s*\(\s*['"]|export\s+(?:type\s+)?[^'"]*from\s+['"])(?:\.\.\/)+walrus-connect\/src(?:\/[^'"]*)?['"]/,
  );

  assert(
    forbiddenSiblingSourceImports.length === 0,
    `${internalWorkspace} must own route source and must not import or re-export ../walrus-connect/src:\n${forbiddenSiblingSourceImports.join('\n')}`,
  );
};

const checkGeneratedDeclarationSurfaces = () => {
  const signerEntry = 'packages/walrus-connect/dist/types/signer-app.d.ts';
  const signerForbidden = [
    { label: 'modal opener', pattern: /\bopenSignTxModal\b/g },
    { label: 'full scan hook', pattern: /\buseWalrusScan\b/g },
    { label: 'sign route outcome', pattern: /\bQRSignOutcome\b/g },
    { label: 'login route outcome', pattern: /\bLoginHostOutcome\b/g },
    { label: 'route protocol declaration', pattern: /['"].*\/protocol\/[^'"]+['"]/g },
    { label: 'route-only modal declaration', pattern: /['"].*\/components\/modal['"]/g },
    { label: 'route-only form declaration', pattern: /['"].*\/components\/form['"]/g },
  ];
  const signerGraph = scanGeneratedDeclarationGraph(signerEntry, signerForbidden);

  assert(
    pathExists(signerEntry),
    `${signerEntry} must exist before boundary verification; run npm run build:connect first`,
  );
  assert(
    signerGraph.matches.length === 0,
    `signer-app generated declaration graph must stay scan-only and must not expose route outcomes, protocol types, modal opener, or full WalrusScan context:\n${signerGraph.matches.join('\n')}`,
  );

  const walletEntry = 'packages/walrus-wallet/dist/types/index.d.ts';
  const walletForbidden = [
    { label: 'private route package', pattern: /@zktx\.io\/walrus-connect-route-internal/g },
    { label: 'public wallet-route path', pattern: /walrus-connect\/wallet-route/g },
    { label: 'modal opener', pattern: /\bopenSignTxModal\b/g },
    { label: 'full scan hook', pattern: /\buseWalrusScan\b/g },
    { label: 'full scan provider', pattern: /\bWalrusScan\b/g },
    { label: 'sign route outcome', pattern: /\bQRSignOutcome\b/g },
    { label: 'login route outcome', pattern: /\bLoginHostOutcome\b/g },
    { label: 'wallet route outcome alias', pattern: /\bWalrusWallet(?:Qr|Login)RouteOutcome\b/g },
    { label: 'route lifecycle variant', pattern: /\b(?:failed_before_submit|execute_result_unknown|submitted_delivery_failed|submitted_finality_unknown|finalized_delivery_failed|result_delivery_failed)\b/g },
    { label: 'sponsored helper', pattern: /\b(?:create|execute)SponsoredTransaction\b/g },
    { label: 'route protocol declaration', pattern: /['"].*\/protocol\/[^'"]+['"]/g },
  ];
  const walletGraph = scanGeneratedDeclarationGraph(walletEntry, walletForbidden);

  assert(
    pathExists(walletEntry),
    `${walletEntry} must exist before boundary verification; run npm run build:wallet first`,
  );
  assert(
    walletGraph.matches.length === 0,
    `walrus-wallet public generated declaration graph must not expose route internals:\n${walletGraph.matches.join('\n')}`,
  );
};

const checkGeneratedDeclarationArtifacts = () => {
  const allowedConnectDeclarations = new Set([
    'packages/walrus-connect/dist/types/components/QRAddress.d.ts',
    'packages/walrus-connect/dist/types/components/QRAddressScan.d.ts',
    'packages/walrus-connect/dist/types/components/WalrusSignerScan.d.ts',
    'packages/walrus-connect/dist/types/index.d.ts',
    'packages/walrus-connect/dist/types/signer-app.d.ts',
    'packages/walrus-connect/dist/types/types.d.ts',
    'packages/walrus-connect/dist/types/utils/signTransactionReview.d.ts',
  ]);
  const connectDeclarations = listGeneratedDeclarationFiles(
    'packages/walrus-connect/dist/types',
  );
  const unexpectedConnectDeclarations = connectDeclarations.filter(
    (file) => !allowedConnectDeclarations.has(file),
  );

  assert(
    unexpectedConnectDeclarations.length === 0,
    `walrus-connect generated declaration artifacts must be limited to public declarations:\n${unexpectedConnectDeclarations.join('\n')}`,
  );

  const allowedWalletDeclarations = new Set([
    'packages/walrus-wallet/dist/types/index.d.ts',
    'packages/walrus-wallet/dist/types/runtime/walletErrors.d.ts',
    'packages/walrus-wallet/dist/types/utils/coinHelpers.d.ts',
    'packages/walrus-wallet/dist/types/utils/publicSuiClient.d.ts',
    'packages/walrus-wallet/dist/types/utils/walletTypes.d.ts',
  ]);
  const walletDeclarations = listGeneratedDeclarationFiles(
    'packages/walrus-wallet/dist/types',
  );
  const unexpectedWalletDeclarations = walletDeclarations.filter(
    (file) => !allowedWalletDeclarations.has(file),
  );

  assert(
    unexpectedWalletDeclarations.length === 0,
    `walrus-wallet generated declaration artifacts must not include private route/runtime/component declarations:\n${unexpectedWalletDeclarations.join('\n')}`,
  );
};

const checkPackArtifacts = () => {
  let connectFiles;
  let walletFiles;
  try {
    connectFiles = runNpmPackDryRun('@zktx.io/walrus-connect');
  } catch (error) {
    fail(`npm pack --dry-run --workspace @zktx.io/walrus-connect failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  try {
    walletFiles = runNpmPackDryRun('@zktx.io/walrus-wallet');
  } catch (error) {
    fail(`npm pack --dry-run --workspace @zktx.io/walrus-wallet failed: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const forbiddenConnectArtifacts = forbiddenPackPaths(connectFiles, [
    { label: 'wallet-route declaration', pattern: /^dist\/types\/wallet-route\.d\.ts$/ },
    { label: 'route protocol declaration', pattern: /^dist\/types\/protocol\// },
    { label: 'route-only modal declaration', pattern: /^dist\/types\/components\/modal\.d\.ts$/ },
    { label: 'route-only form declaration', pattern: /^dist\/types\/components\/form\.d\.ts$/ },
    { label: 'route-only QR login declaration', pattern: /^dist\/types\/components\/QRLogin\.d\.ts$/ },
    { label: 'route-only QR sign declaration', pattern: /^dist\/types\/components\/QRSign\.d\.ts$/ },
    { label: 'full scan provider declaration', pattern: /^dist\/types\/components\/WalrusScan\.d\.ts$/ },
    { label: 'route helper declaration', pattern: /^dist\/types\/utils\/sponsoredTransaction\.d\.ts$/ },
    { label: 'route lifecycle declaration', pattern: /^dist\/types\/utils\/signProtocol\.d\.ts$/ },
    { label: 'route protocol transport declaration', pattern: /^dist\/types\/utils\/message\.d\.ts$/ },
    { label: 'route WebRTC declaration', pattern: /^dist\/types\/webrtc\// },
  ]);

  assert(
    forbiddenConnectArtifacts.length === 0,
    `walrus-connect npm pack artifact must not include route declarations or route-only modal/form declarations:\n${forbiddenConnectArtifacts.join('\n')}`,
  );

  const forbiddenWalletArtifacts = forbiddenPackPaths(walletFiles, [
    { label: 'wallet internal route declaration', pattern: /^dist\/types\/internal\// },
    { label: 'wallet private component declaration', pattern: /^dist\/types\/components\// },
    { label: 'wallet private runtime declaration', pattern: /^dist\/types\/runtime\/(?!walletErrors\.d\.ts$)/ },
    { label: 'wallet private state declaration', pattern: /^dist\/types\/recoil\// },
    { label: 'wallet private utility declaration', pattern: /^dist\/types\/utils\/(?!coinHelpers\.d\.ts$|publicSuiClient\.d\.ts$|walletTypes\.d\.ts$)/ },
  ]);

  assert(
    forbiddenWalletArtifacts.length === 0,
    `walrus-wallet npm pack artifact must not include private route/runtime declarations:\n${forbiddenWalletArtifacts.join('\n')}`,
  );
};

const checkBoundaryInventoryMapping = () => {
  const file = 'BOUNDARY_INVENTORY.md';
  assert(pathExists(file), `${file} must exist`);
  if (!pathExists(file)) return;

  const text = readText(file);
  const rows = text
    .split('\n')
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /^\|\s*F-[A-Z0-9-]+\s*\|/.test(line));

  assert(rows.length > 0, `${file} must contain forbidden surface rows with F-* ids`);

  const unmapped = [];
  for (const { line, index } of rows) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const checkCell = cells[3] ?? '';
    const checks = checkCell
      .split(/<br>|,/)
      .map((value) => value.replace(/`/g, '').trim())
      .filter(Boolean);

    if (checks.length === 0 || checks.some((check) => !verifierChecks.has(check))) {
      unmapped.push(`${file}:${index}: ${line.trim()}`);
    }
  }

  assert(
    unmapped.length === 0,
    `every forbidden inventory surface must map to at least one known verifier check:\n${unmapped.join('\n')}`,
  );
};

const checkDocumentation = () => {
  const docs = [
    'BOUNDARY_INVENTORY.md',
    'SMOKE_CHECKLIST.md',
    'packages/walrus-connect/README.md',
    'packages/walrus-wallet/README.md',
  ].filter((file) => existsSync(path.join(root, file)));

  const staleMatches = scanFiles(
    docs,
    /QRSignOutcomeError|LoginHostOutcomeError|the QR route's structured outcome error|preserv(?:e|es|ing)\s+route outcome|preserv(?:e|es|ing)\s+the route outcome/,
  );

  assert(
    staleMatches.length === 0,
    `wallet-facing docs must not mention stale route-level outcomes:\n${staleMatches.join('\n')}`,
  );
};

const checkSuiClientBoundarySource = () => {
  const files = [
    ...listFiles('packages/walrus-wallet/src'),
    ...listFiles(internalWorkspace + '/src'),
    ...listFiles('packages/walrus-connect/src'),
    ...listFiles('packages/clip/src'),
    ...listFiles('packages/demo/src'),
  ];
  const allowedFiles = new Set([
    'packages/walrus-wallet/src/utils/suiClient.ts',
    'packages/walrus-connect-route-internal/src/utils/suiClient.ts',
  ]);

  const directClientMatches = scanFiles(
    files,
    suiClientConstructionPattern,
  )
    .concat(files.flatMap((file) => scanSuiClientRuntimeEdges(file)))
    .filter((line) => !isAllowedLine(line, allowedFiles));

  assert(
    directClientMatches.length === 0,
    `Sui client and fullnode URL construction must stay in the wallet or private route client boundary:\n${directClientMatches.join('\n')}`,
  );
};

const checkSuiTransactionExecutionBoundary = () => {
  const files = [
    ...listFiles('packages/walrus-wallet/src'),
    ...listFiles(internalWorkspace + '/src'),
    ...listFiles('packages/walrus-connect/src'),
    ...listFiles('packages/clip/src'),
    ...listFiles('packages/demo/src'),
  ];
  const allowedFiles = new Set([
    'packages/walrus-wallet/src/utils/suiClient.ts',
    'packages/walrus-connect-route-internal/src/utils/suiClient.ts',
  ]);

  const directExecutionMatches = scanFiles(
    files,
    suiTransactionBoundaryPattern,
  )
    .concat(files.flatMap((file) => scanSuiTransactionBuildCalls(file)))
    .filter((line) => !isAllowedSuiTransactionBoundaryLine(line, allowedFiles));
  const publicReviewDryRunMatches = scanFiles(
    [publicReviewHelperFile],
    suiTransactionBoundaryPattern,
  ).filter(isPublicReviewDryRunLine);

  assert(
    directExecutionMatches.length === 0,
    `Sui transaction build/execute/wait/dry-run/simulate/digest calls must stay behind the owner boundary; the public review helper is the only inventoried temporary dry-run exception:\n${directExecutionMatches.join('\n')}`,
  );
  assert(
    publicReviewDryRunMatches.length === 1,
    `the public review helper dry-run exception must stay narrow and appear exactly once:\n${publicReviewDryRunMatches.join('\n')}`,
  );
};

const checkSuiPublicTypeSurfaces = () => {
  const declarationFiles = [
    ...listGeneratedDeclarationFiles('packages/walrus-connect/dist/types'),
    ...listGeneratedDeclarationFiles('packages/walrus-wallet/dist/types'),
  ];
  const unexpected = [];

  for (const file of declarationFiles) {
    const specifiers = declarationSpecifiers(readText(file)).filter((specifier) =>
      mystenPublicTypeSpecifierPattern.test(specifier),
    );

    for (const specifier of specifiers) {
      if (!isAllowedPublicSuiTypeSurface(file, specifier)) {
        unexpected.push(`${file}: ${specifier}`);
      }
    }
  }

  assert(
    unexpected.length === 0,
    `public generated declarations must expose only inventoried Sui, Wallet Standard, or dApp Kit type surfaces:\n${unexpected.join('\n')}`,
  );
};

const checkCompletionState = () => {
  const statusLines = execFileSync('git', ['status', '--short'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter(Boolean);

  const unstagedOrUntracked = statusLines.filter((line) => {
    const indexState = line[0];
    const worktreeState = line[1];
    return indexState === '?' || worktreeState !== ' ';
  });

  assert(
    unstagedOrUntracked.length === 0,
    `completion requires a coherent staged snapshot; stage or classify these files:\n${unstagedOrUntracked.join('\n')}`,
  );

  const smoke = readText('SMOKE_CHECKLIST.md');
  const nonPassSmokeMatches = smoke
    .split('\n')
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /^Status: /.test(line) && !/^Status: pass\./.test(line))
    .map(({ index, line }) => `SMOKE_CHECKLIST.md:${index}: ${line}`);

  assert(
    /^Current status: verified\./m.test(smoke),
    'completion requires SMOKE_CHECKLIST.md current status to be verified',
  );
  assert(
    nonPassSmokeMatches.length === 0,
    `completion requires every manual smoke entry to be pass:\n${nonPassSmokeMatches.join('\n')}`,
  );
};

checkVerifierNegativeControls();
checkWorkspacePackage();
checkPublicExports();
checkImports();
checkSourceSurfaces();
checkInternalRouteSourceOwnership();
checkGeneratedDeclarationSurfaces();
checkGeneratedDeclarationArtifacts();
checkPackArtifacts();
checkBoundaryInventoryMapping();
checkDocumentation();
checkSuiClientBoundarySource();
checkSuiTransactionExecutionBoundary();
checkSuiPublicTypeSurfaces();

if (mode === 'completion') {
  checkCompletionState();
}

if (failures.length > 0) {
  console.error(`Walrus Clip ${mode} verification failed:`);
  failures.forEach((message, index) => {
    console.error(`\n${index + 1}. ${message}`);
  });
  process.exitCode = 1;
} else {
  console.log(`Walrus Clip ${mode} verification passed.`);
}
