import {
  existsSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const allowlists = {
  'walrus-connect': new Set([
    'components/QRAddress.d.ts',
    'components/QRAddressScan.d.ts',
    'components/WalrusSignerScan.d.ts',
    'index.d.ts',
    'signer-app.d.ts',
    'types.d.ts',
    'utils/signTransactionReview.d.ts',
  ]),
  'walrus-wallet': new Set([
    'index.d.ts',
    'runtime/walletErrors.d.ts',
    'utils/coinHelpers.d.ts',
    'utils/publicSuiClient.d.ts',
    'utils/walletTypes.d.ts',
  ]),
};

const packageName = process.argv[2];
const allowlist = allowlists[packageName];

if (!allowlist) {
  console.error(
    `Usage: node scripts/prune-boundary-declarations.mjs ${Object.keys(allowlists).join('|')}`,
  );
  process.exit(1);
}

const typesRoot = path.join(repoRoot, 'packages', packageName, 'dist', 'types');

const listDeclarations = (dir) => {
  if (!existsSync(dir)) return [];

  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current)) {
      const absoluteEntry = path.join(current, entry);
      const stat = statSync(absoluteEntry);
      if (stat.isDirectory()) {
        visit(absoluteEntry);
      } else if (absoluteEntry.endsWith('.d.ts')) {
        files.push(path.relative(typesRoot, absoluteEntry).split(path.sep).join('/'));
      }
    }
  };

  visit(dir);
  return files.sort();
};

const pruneEmptyDirectories = (dir) => {
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    const absoluteEntry = path.join(dir, entry);
    if (statSync(absoluteEntry).isDirectory()) {
      pruneEmptyDirectories(absoluteEntry);
    }
  }

  if (dir !== typesRoot && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true });
  }
};

for (const file of listDeclarations(typesRoot)) {
  if (!allowlist.has(file)) {
    rmSync(path.join(typesRoot, file));
  }
}

pruneEmptyDirectories(typesRoot);

const missing = [...allowlist].filter(
  (file) => !existsSync(path.join(typesRoot, file)),
);

if (missing.length > 0) {
  console.error(
    `${packageName} public declaration pruning removed or missed required declarations:\n${missing.join('\n')}`,
  );
  process.exit(1);
}
