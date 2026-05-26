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

Legacy dApp Kit hooks that implement sign-and-execute by calling
`sui:signTransaction` and then executing outside the wallet are not treated as a
core compatibility target for QR-only accounts. dApps that need QR signing
should call the selected wallet's Wallet Standard
`sui:signAndExecuteTransaction` feature directly until the modern dApp Kit
migration is implemented.

## Owned Responsibilities

- Wallet Standard registration for `Walrus Clip`.
- Wallet account/session state and Wallet Standard events.
- Routing Wallet Standard signing requests to the active supported signer path.
- zkLogin nonce, proof, password confirmation, and local signer handling.
- Centralized Sui client creation for the current legacy SDK boundary.
- Read-only basic `Coin<T>` helper queries through the wallet Sui client
  boundary.

## Not Owned Here

- dApp-specific checkout, kiosk, NFT dashboard, or advanced asset UX.
- QR/WebRTC protocol internals beyond invoking the internal signing route.
- Sui SDK 2.x migration work. That remains a separate modernization step.

## Public React Surface

- `WalrusWallet`: provider that registers the Wallet Standard wallet and hosts
  the internal signing route UI.
- `useWalrusWallet`: reference-app helper for OAuth callback completion and
  connection status.
- `WALLET_NAME`: the Wallet Standard display name.
- `createWalrusWalletDappKitNetworks`: temporary legacy dApp Kit network-map
  helper used by the reference apps until the modern dApp Kit/Sui client
  boundary is implemented.
- `WalrusWalletError` and its typed subclasses: caller-visible wallet errors
  for account mismatch, network mismatch, unsupported route features,
  QR/login route failures, pre-submit execution failure, and post-submit
  uncertainty.
- `getWalrusCoinBalances`, `getWalrusCoins`, `formatWalrusCoinAmount`, and
  `WalrusCoinBalance`: read-only basic coin helper surface. These helpers do
  not build or submit transactions. `formattedBalance` is `null` when coin
  metadata is unavailable; callers must use raw integer balances in that case.
