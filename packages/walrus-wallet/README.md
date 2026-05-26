# @zktx.io/walrus-wallet

Walrus Wallet registers a Sui Wallet Standard wallet named `Walrus Clip`.
dApps should integrate it through Wallet Standard provider wiring and call the
normal connect/sign features exposed by the selected wallet.

The wallet runtime routes Wallet Standard requests to one of two signing paths:

- local zkLogin signer, when a local account is available;
- QR/WebRTC air-gapped signing, when the wallet is connected through a remote
  Clip signer.

QR/WebRTC is an internal signing route. dApps should not call QR modal,
transport, or protocol APIs directly.

The current QR route finalizes `sui:signAndExecuteTransaction` requests. Pure
`sui:signTransaction` is exposed only when a local signer is available, because
the preserved QR/WebRTC protocol baseline does not model a sign-only terminal
state.

dApp Kit hooks that implement sign-and-execute by calling
`sui:signTransaction` and then executing outside the wallet are not treated as a
core compatibility target for QR-only accounts. dApps that need QR signing
should call the selected wallet's Wallet Standard
`sui:signAndExecuteTransaction` feature, or the modern dApp Kit
`dAppKit.signAndExecuteTransaction({ transaction })` action, which the wallet
runtime delegates to its `sui:signAndExecuteTransaction` feature.

## Owned Responsibilities

- Wallet Standard registration for `Walrus Clip`.
- Wallet account/session state and Wallet Standard events.
- Routing Wallet Standard signing requests to the active supported signer path.
- zkLogin nonce, proof, password confirmation, and local signer handling.
- Centralized Sui client creation through the wallet Sui client boundary
  (currently `SuiJsonRpcClient` from `@mysten/sui@2.x`'s `jsonRpc` subpath).
- Read-only basic `Coin<T>` helper queries through the wallet Sui client
  boundary.

## Not Owned Here

- dApp-specific checkout, kiosk, NFT dashboard, or advanced asset UX.
- QR/WebRTC protocol internals beyond invoking the internal signing route.
- dApp Kit provider wiring. Modern dApp Kit (`@mysten/dapp-kit-react`,
  `@mysten/dapp-kit-core`) is owned by the consumer app shell; the wallet
  exposes only the network tuple and the Sui client factory.
- SDK 2.x Core/gRPC owner-boundary migration. That remains a separate
  modernization step; the wallet currently uses `SuiJsonRpcClient` for
  JSON-RPC compatibility.

## Public React Surface

- `WalrusWallet`: provider that registers the Wallet Standard wallet and hosts
  the internal signing route UI. Accepts an optional
  `onLogout?: () => void | Promise<void>` prop with **override semantics**:
  when set, the action drawer's logout button awaits `onLogout()` and does
  not call the wallet's own `standard:disconnect`; when unset, the drawer
  calls `standard:disconnect.disconnect()` directly. App shells using modern
  dApp Kit typically pass `onLogout={() => dAppKit.disconnectWallet()}` so
  exactly one wallet disconnect runs per logout.
- `useWalrusWallet`: reference-app helper for OAuth callback completion and
  connection status.
- `WALLET_NAME`: the Wallet Standard display name.
- `WALRUS_WALLET_SUPPORTED_NETWORKS`: a `readonly ['mainnet', 'testnet',
  'devnet']` tuple of the networks the wallet runtime supports. Consumer
  apps spread it into modern dApp Kit's `createDAppKit({ networks })`.
- `createWalrusWalletSuiClient(network)`: returns a JSON-RPC-compatible
  Sui client (`SuiJsonRpcClient`) for the requested network, sourced from
  the wallet's Sui client boundary. Consumer apps pass it as
  `createDAppKit({ createClient })`.
- `WalrusWalletError` and its typed subclasses: caller-visible wallet errors
  for account mismatch, network mismatch, unsupported route features,
  QR/login route failures, pre-submit execution failure, and post-submit
  uncertainty.
- `getWalrusCoinBalances`, `getWalrusCoins`, `formatWalrusCoinAmount`, and
  `WalrusCoinBalance`: read-only basic coin helper surface. These helpers do
  not build or submit transactions. `formattedBalance` is `null` when coin
  metadata is unavailable; callers must use raw integer balances in that case.
