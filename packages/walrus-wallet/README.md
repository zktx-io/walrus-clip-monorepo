# @zktx.io/walrus-wallet

Walrus Wallet registers a Sui Wallet Standard wallet named `Walrus Clip`.
dApps should integrate it through Wallet Standard provider wiring and call the
two features the wallet advertises:

- `standard:connect`, `standard:disconnect`, `standard:events`
- `sui:signAndExecuteTransaction`

Both flows are air-gapped: the wallet runtime hosts a QR/WebRTC session and
delegates signing to a remote Clip signer device. There is no local signer,
no zkLogin proof generation, no password modal, and no sponsored
transaction path inside this package. `sui:signTransaction` and
`sui:signPersonalMessage` are intentionally not advertised; dApps that need
QR signing must call `sui:signAndExecuteTransaction` (directly or through
modern dApp Kit's `dAppKit.signAndExecuteTransaction({ transaction })`).

QR/WebRTC is an internal signing route. dApps should not call QR modal,
transport, or protocol APIs directly.

## Owned Responsibilities

- Wallet Standard registration for `Walrus Clip` with the four features
  listed above.
- Wallet account/session state and Wallet Standard events.
- Routing Wallet Standard `sui:signAndExecuteTransaction` requests to the
  internal QR/WebRTC signing route.
- Centralized Sui client creation through the wallet Sui client boundary.
  The boundary owns `SuiJsonRpcClient` (from `@mysten/sui@2.x`'s `jsonRpc`
  subpath) for the public `createWalrusWalletSuiClient` consumed by dApp
  Kit `createClient` and the wallet read-only coin helpers. Transaction
  build/execute/wait happen inside the QR sign route owner
  (`@zktx.io/walrus-connect-route-internal`), not here.
- Read-only basic `Coin<T>` helper queries through the wallet Sui client
  boundary's JSON-RPC compatibility client.

## Not Owned Here

- dApp-specific checkout, kiosk, NFT dashboard, or advanced asset UX.
- QR/WebRTC protocol internals beyond invoking the internal signing route.
- dApp Kit provider wiring. Modern dApp Kit (`@mysten/dapp-kit-react`,
  `@mysten/dapp-kit-core`) is owned by the consumer app shell; the wallet
  exposes only the network tuple and the Sui client factory.
- Local signing, zkLogin, Enoki, OAuth, password modal, and sponsored
  transaction helpers. These are deliberately removed from the product
  surface.
- Migrating the public `createWalrusWalletSuiClient` return type away from
  `SuiJsonRpcClient`. The QR-route runtime transport has moved to
  `SuiGrpcClient` inside the private route owner; changing the public
  helper return type would be a separate public-API change.

## Public React Surface

- `WalrusWallet`: provider that registers the Wallet Standard wallet and hosts
  the internal QR signing route UI. Accepts an optional
  `iceConfigUrl?: string` prop for app-owned WebRTC ICE/TURN configuration.
  The URL must serve `{url}/ice-conf.json`. When omitted, the internal route
  uses the bundled public STUN plus test public TURN fallback. Production apps
  should provide their own short-lived TURN credential service through this
  prop.
  Also accepts an optional
  `onLogout?: () => void | Promise<void>` prop with **override semantics**:
  when set, the action drawer's logout button awaits `onLogout()` and does
  not call the wallet's own `standard:disconnect`; when unset, the drawer
  calls `standard:disconnect.disconnect()` directly. App shells using modern
  dApp Kit typically pass `onLogout={() => dAppKit.disconnectWallet()}` so
  exactly one wallet disconnect runs per logout.
- `WALLET_NAME`: the Wallet Standard display name.
- `WALRUS_WALLET_SUPPORTED_NETWORKS`: a `readonly ['mainnet', 'testnet',
  'devnet']` tuple of the networks the wallet runtime supports. Consumer
  apps spread it into modern dApp Kit's `createDAppKit({ networks })`.
- `createWalrusWalletSuiClient(network)`: returns a JSON-RPC-compatible
  Sui client (`SuiJsonRpcClient`) for the requested network, sourced from
  the wallet's Sui client boundary. Consumer apps pass it as
  `createDAppKit({ createClient })`.
- `WalrusWalletError` and its typed subclasses
  (`WalrusWalletAccountMismatchError`, `WalrusWalletChainMismatchError`,
  `WalrusWalletFeatureUnavailableError`, `WalrusWalletLoginRouteError`,
  `WalrusWalletQrRouteError`): caller-visible wallet errors for account
  mismatch, network mismatch, unsupported route features, QR/login route
  failures, and post-submit uncertainty (preserved on
  `WalrusWalletQrRouteError`).
- `getWalrusCoinBalances`, `getWalrusCoins`, `formatWalrusCoinAmount`, and
  `WalrusCoinBalance`: read-only basic coin helper surface. These helpers do
  not build or submit transactions. `formattedBalance` is `null` when coin
  metadata is unavailable; callers must use raw integer balances in that case.
