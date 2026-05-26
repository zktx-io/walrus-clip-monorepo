# Walrus Clip Smoke Checklist

Use this checklist after changes that touch Wallet Standard runtime,
QR/WebRTC signing, account state, network selection, or signing outcomes.

Current status: implemented but unverified.

Reason: the current boundary work keeps existing QR/WebRTC and Wallet Standard
signing behavior routed through the same public outcomes, but it touches the
signing/client boundary and therefore still requires manual browser/device
smoke before release. Automated static scans, package builds, wallet
runtime/helper tests, and `walrus-connect` protocol tests are recorded
separately from manual smoke evidence.

Automated checks run:

- `npm run build:connect`
- `npm run build:connect-route-internal`
- `npm run build:wallet`
- `npm --workspace @zktx.io/walrus-connect test`
- `npm --workspace @zktx.io/walrus-wallet test`
- `npm --workspace clip run build`
- `npm --workspace demo run build`
- `npm run verify:boundary`
- `npm pack --dry-run --workspace @zktx.io/walrus-connect`
- `npm pack --dry-run --workspace @zktx.io/walrus-wallet`
- `git diff --cached --check`
- verifier negative controls for repeated forbidden generated declaration and
  tarball artifact matches
- full generated declaration artifact allowlist checks for `walrus-connect` and
  `walrus-wallet`
- wallet public error contract scan for route lifecycle outcome aliases and
  lifecycle variant strings
- `walrus-connect` no-camera scan regression test, covering warning and
  Promise settlement when no camera is available
- static scans for public `wallet-route` imports, private route package source
  ownership, wallet public type leaks, signer-app generated d.ts route leaks,
  and connect/wallet tarball declaration artifacts
- static scans for Sui client runtime imports/re-exports/dynamic imports,
  require-style imports, fullnode URL construction, and transaction
  build/execute/wait/dry-run/simulate/digest calls staying behind the
  inventoried owner boundaries

Completion gate:

- `npm run verify:completion` must pass before this change can be called
  `verified`.
- While any manual item below is `not run`, `verify:completion` is expected to
  fail and the correct status remains `implemented but unverified`.

## QR Login

Status: not run.

- Start the reference Clip app.
- Select `Walrus Clip` from the Wallet Standard wallet list.
- Complete QR login with a remote Clip signer.
- Confirm the dApp sees a connected Wallet Standard account.
- Confirm no JWT, OAuth token, private key, proof material, or signature is
  logged.

## QR Sign

Status: not run.

- Connect through QR login.
- Trigger a dApp `sui:signAndExecuteTransaction` request through Wallet
  Standard.
- Confirm the QR signing route shows the transaction review on the remote
  signer.
- Approve signing and confirm the dApp receives
  `{ digest, bytes, signature, effects }` or a structured error that preserves a
  submitted digest when submission happened.
- Confirm QR-only accounts do not advertise pure `sui:signTransaction` at the
  account feature level.
- Confirm the legacy dApp Kit `useSignAndExecuteTransaction` path is not used
  for QR-only accounts, because it signs first and executes outside the wallet
  feature.

## Direct Wallet Standard Sign

Status: not run.

- Connect `Walrus Clip` through the local zkLogin path.
- Trigger `sui:signTransaction` and confirm password approval is required before
  signing.
- Confirm the dApp receives Wallet Standard `{ bytes, signature }`.
- Trigger `sui:signAndExecuteTransaction` and confirm the dApp receives
  `{ digest, bytes, signature, effects }`.

## Sponsored Transaction Path

Status: not run.

- Configure `sponsoredUrl` for `WalrusWallet`.
- Trigger QR `sui:signAndExecuteTransaction` and confirm sponsor creation,
  signing, execution, digest preservation, and effects reporting.
- Trigger local zkLogin `sui:signAndExecuteTransaction` and confirm the local
  route signs the sponsor-created transaction bytes, not an unsponsored
  transaction.
- Confirm sponsor execution failure reports a digest when the sponsor has
  already created one, using `WalrusWalletTransactionUncertainError` or
  `WalrusWalletQrRouteError`.

## Cancel And Error

Status: not run.

- Close the QR sign modal before the remote signer connects.
- Cancel signing after the remote signer receives the request.
- Reject the remote transaction review.
- Drop the WebRTC connection before submission and after submission.
- Confirm each path resolves to a caller-visible Wallet Standard error and does
  not leave the request pending.
- When a transaction digest is known, confirm the error preserves that digest or
  explicit finality uncertainty.

## Network Mismatch

Status: not run.

- Connect on one Sui network and then switch the dApp network.
- Confirm `Walrus Clip` emits a network mismatch notification.
- Confirm the wallet disconnects and does not sign on the wrong chain.
- Confirm a new connection on the selected network succeeds.
