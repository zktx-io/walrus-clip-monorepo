# Walrus Clip Smoke Checklist

Use this checklist after changes that touch Wallet Standard runtime,
QR/WebRTC signing, account state, network selection, or signing outcomes.

Current status: verified for the QR/WebRTC stabilization scope in
`3e421ad`. The product scope has been narrowed to air-gapped login and
air-gapped `sui:signAndExecuteTransaction`; the smoke checklist below
covers only those flows.

Reason: automated checks pass and the user completed the QR/WebRTC browser
smoke paths touched by `3e421ad fix(connect): stabilize qr webrtc connection`
for QR login, QR sign approval, and remote review rejection on testnet.
Local zkLogin signing, sponsored transactions, the `sui:signTransaction`
feature, and the `sui:signPersonalMessage` feature have been removed from the
product surface; they are not smoke gates and are not reachable from
`@zktx.io/walrus-wallet`. Network mismatch and disconnect smoke are still
unrecorded under the new product scope.

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
- `git diff --check`
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

- `npm run verify:completion` must pass before the architecture cycle can be
  called `verified`. It is expected to fail until QR sign approve, QR sign
  reject/cancel, network mismatch, and disconnect smoke are recorded against
  the narrowed product scope.

## QR Login

Status: pass.

Evidence: user-reported browser smoke on 2026-05-27. The scanner logs showed
direct P2P success twice on testnet: `direct PeerJS open`, `direct connection
opened`, `login.proof`, `login.result`, `login.result.ack`, and cleanup with
`isConnected: true`.

- Start the reference Clip app.
- Select `Walrus Clip` from the Wallet Standard wallet list.
- Complete QR login with a remote Clip signer.
- Confirm the dApp sees a connected Wallet Standard account.
- Confirm the account advertises only `sui:signAndExecuteTransaction` at the
  Wallet Standard feature level.
- Confirm no private key, proof material, or signature is logged.

## QR Sign Approve

Status: pass.

Evidence: user-reported browser smoke on 2026-05-27. QR sign approval was
completed after QR login against the testnet demo flow.

- Connect through QR login.
- Trigger a dApp `sui:signAndExecuteTransaction` request through Wallet
  Standard or modern dApp Kit `dAppKit.signAndExecuteTransaction({ transaction })`.
- Confirm the QR signing route shows the transaction review on the remote
  signer.
- Approve signing and confirm the dApp receives
  `{ digest, bytes, signature, effects }` or a structured
  `WalrusWalletQrRouteError` that preserves the submitted digest when
  submission happened.

## QR Sign Reject And Cancel

Status: partial pass.

Evidence: user-reported browser smoke on 2026-05-27. Remote transaction review
rejection was exercised. Other cancel/error cases below are still unrecorded.

- Close the QR sign modal before the remote signer connects.
- Cancel signing after the remote signer receives the request.
- Reject the remote transaction review. Pass, user-reported 2026-05-27.
- Drop the WebRTC connection before submission and after submission.
- Confirm each path resolves to a structured Wallet Standard error
  (`WalrusWalletQrRouteError` or `WalrusWalletLoginRouteError`) and does not
  leave the request pending.
- When a transaction digest is known, confirm the error preserves that digest
  or explicit finality uncertainty.

## Network Mismatch

Status: not run.

- Connect on one Sui network and then switch the dApp network.
- Confirm `Walrus Clip` emits a network mismatch notification.
- Confirm the wallet disconnects and does not sign on the wrong chain.
- Trigger a `sui:signAndExecuteTransaction` request with a chain that does
  not match the current wallet network and confirm the dApp receives a
  `WalrusWalletChainMismatchError` without launching the QR modal.
- Confirm a new connection on the selected network succeeds.

## Disconnect

Status: not run.

- Connect through QR login.
- Trigger `standard:disconnect` (or click logout in the action drawer).
- Confirm `getAccountData()` is cleared, `setIsConnected(false)` fires, and the
  Wallet Standard `change` event is emitted with an empty accounts list.
- Reconnect through QR login and confirm a fresh QR session is shown rather
  than a stored account being restored.
