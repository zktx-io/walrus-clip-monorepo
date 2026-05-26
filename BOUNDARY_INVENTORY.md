# Walrus Clip Boundary Inventory

This file is the source of truth for the current boundary gate. It does not
replace `AGENTS.md`; it maps each allowed and forbidden surface to automated
verification in `scripts/verify-boundary.mjs`.

## Product Boundary

The dApp-facing boundary is `@zktx.io/walrus-wallet` Wallet Standard
registration/runtime. External dApps must not be able to integrate directly
with the QR/WebRTC wallet route through package exports, source imports,
generated declarations, or npm tarball artifacts.

## Sui Client Boundary Baseline

Current status: Sui SDK/Core client boundary baseline before an SDK 2.x
dependency upgrade. The dependency versions remain `@mysten/sui@1.38.0`,
`@mysten/dapp-kit@0.18.0`, and `@mysten/wallet-standard@0.17.0`.
`.WORK/ts-sdks/packages/sui/package.json` is the SDK 2.17.0 reference source.

Invariant: Sui client construction, fullnode URL selection, transaction
build, transaction execution, transaction finality wait, and route
dry-run calls must be owned by a package boundary before any SDK 2.x/Core/gRPC
migration. Wallet Standard caller-visible results must preserve the fields that
belong to each public outcome: sign-only returns `bytes` and `signature`, while
post-submit sign-and-execute paths preserve `digest`, `bytes`, `signature`,
`effects`, and explicit finality uncertainty instead of collapsing outcomes
into generic strings.

Owners:

- `packages/walrus-wallet/src/utils/suiClient.ts` owns wallet runtime Sui
  client creation, dApp Kit network-map URL selection, local route transaction
  build, local route execution, local finality wait, and zkLogin epoch reads.
- `packages/walrus-connect-route-internal/src/utils/suiClient.ts` owns private
  QR/WebRTC route Sui client creation, GraphQL client creation, transaction
  build, digest calculation, dry-run, execution, and finality wait.
- `packages/clip` and `packages/demo` remain thin consumers of
  `createWalrusWalletDappKitNetworks`; they must not construct Sui clients or
  fullnode URL maps directly.
- `packages/walrus-connect/src/utils/signTransactionReview.ts` remains a
  temporary public review helper that can dry-run through an injected client.
  It is inventoried as a legacy exception, not as a new owner.

### Sui Usage Inventory

| Surface | Current repo usage | Owner | Status | SDK 2.17.0 target fact | Gate |
| --- | --- | --- | --- | --- | --- |
| `SuiClient` / `getFullnodeUrl` runtime construction | wallet and private route client helpers only | wallet + private route client boundaries | keep temporarily | SDK 2.17.0 still exports `client`, but Core/gRPC clients are available under `grpc` and `client` | `sui-client-boundary-source` |
| `SuiClient` type surface | wallet helpers, coin helpers, private route review, public review helper | wallet + private route boundaries; public review helper type exception | keep temporarily | SDK 2.17.0 still has client types, but public helper type exposure must be reviewed during the dependency upgrade | inventory only; runtime import scan blocks new construction |
| `SuiGraphQLClient` | private route signature verification client helper | private route client boundary | keep temporarily | SDK 2.17.0 GraphQL client exists and constructor requires `network` with `url` | `sui-client-boundary-source` |
| dApp Kit provider network config | `clip` and `demo` consume `createWalrusWalletDappKitNetworks` | wallet temporary dApp Kit adapter | move behind boundary | modern dApp Kit core derives chain from current client; replacement is blocked by dependency upgrade | `sui-client-boundary-source` |
| `executeTransactionBlock` | local wallet execution and QR host execution via boundary wrappers | wallet + private route client boundaries | move behind boundary | SDK 2.17.0 Core/gRPC/GraphQL method is `executeTransaction({ transaction, signatures })`; JSON-RPC keeps legacy method behind `jsonRpc` | `sui-transaction-execution-boundary` |
| `waitForTransaction` | local wallet confirmation and QR route finality via boundary wrappers | wallet + private route client boundaries | move behind boundary | SDK 2.17.0 Core keeps `waitForTransaction`, but result shape is `TransactionResult` / `FailedTransaction` with include flags | `sui-transaction-execution-boundary` |
| `dryRunTransactionBlock` | private route review via boundary wrapper; public review helper temporary exception | private route client boundary; public helper exception | move behind boundary / keep temporarily | SDK 2.17.0 Core/GQL/gRPC replacement is `simulateTransaction`; dry-run response mapping requires source verification | `sui-transaction-execution-boundary` |
| `Transaction` build/from/toJSON/getDigest | wallet, private route, public review helper, demo kiosk | wallet + private route for runtime build; private route client boundary owns digest calculation; protocol validation owns digest comparison | keep temporarily | SDK 2.17.0 still exports `Transaction`, `Transaction.from`, `toJSON`, `build`, and `getDigest`; serialized v2 data and supported intents must be re-checked before upgrade | `sui-transaction-execution-boundary` for build and digest |
| zkLogin SDK imports | wallet zkLogin nonce/proof/signer and Clip signer app public identifier type | wallet zkLogin runtime; clip reference app | requires source verification | SDK 2.17.0 exports current names, but `jwtToAddress(jwt, salt, legacyAddress)` requires an explicit legacy-address flag | source inventory; no SDK 2.x implementation yet |
| Wallet Standard `sui:signTransaction` input/output types | wallet runtime and private/public signer types | wallet runtime public outcome boundary | blocked by dependency upgrade | `.WORK/ts-sdks/packages/wallet-standard/package.json` is `@mysten/wallet-standard@0.20.3` with `{ toJSON }` input and `{ bytes, signature }` output | wallet public outcome tests + boundary scans |
| Wallet Standard `sui:signAndExecuteTransaction` input/output types | wallet runtime and private/public signer types | wallet runtime public outcome boundary | blocked by dependency upgrade | `.WORK/ts-sdks/packages/wallet-standard/package.json` is `@mysten/wallet-standard@0.20.3` with `{ toJSON }` input and `{ bytes, signature, digest, effects }` output | wallet public outcome tests + boundary scans |
| read-only coin helpers | `getWalrusCoinBalances` and `getWalrusCoins` through wallet client helper | wallet read-only helper surface | keep temporarily | SDK 2.17.0 Core uses `listBalances`, `listCoins`, and `getCoinMetadata`; current `getAllBalances`/`getCoins` mapping requires verification | wallet helper tests |

Unverified SDK APIs are not implemented in this baseline. They remain
`requires source verification` until the dependency upgrade task maps result
shapes, include flags, zkLogin address compatibility, and Wallet Standard
feature behavior from `.WORK/ts-sdks`.

## Public Surface

### `@zktx.io/walrus-wallet`

- `WalrusWallet`: registers the Wallet Standard wallet and hosts private route
  UI.
- `useWalrusWallet`: reference app helper for OAuth callback completion and
  connection status.
- `WALLET_NAME`: Wallet Standard display name.
- `./index.css`: wallet provider styles.
- `getWalrusCoinBalances`, `getWalrusCoins`, `formatWalrusCoinAmount`, and
  `WalrusCoinBalance`: read-only basic `Coin<T>` helper surface backed by the
  wallet Sui client boundary.
- `createWalrusWalletDappKitNetworks`: temporary dApp Kit network-map helper
  until the dApp Kit/Sui client migration removes scattered fullnode setup.
- `WalrusWalletError` and typed subclasses: caller-visible recovery contract
  for account mismatch, network mismatch, unsupported features, QR/login route
  failures, pre-submit execution failure, and post-submit uncertainty. These
  errors expose wallet-owned recovery fields only, not route lifecycle outcome
  unions.

### `@zktx.io/walrus-connect`

- Root export: `QRAddress`, `QRAddressScan`, `formatSignTransactionReview`,
  `NETWORK`, `NotiVariant`, `ClipSigner`, and `SignTransactionReview`.
- `./signer-app` export: `WalrusSignerScan`, `useWalrusSignerScan`,
  `formatSignTransactionReview`, `ClipSigner`, `NETWORK`, `NotiVariant`, and
  `SignTransactionReview`.
- `./index.css`: shared QR/reference signer styles.

### `packages/clip`

- May use `WalrusWallet`, `WALLET_NAME`, and `useWalrusWallet` from
  `walrus-wallet`.
- May use `WalrusSignerScan`, `useWalrusSignerScan`, and
  `formatSignTransactionReview` only for the reference signer app scan flow.
- Owns OAuth callback handling and dApp Kit provider wiring.

### `packages/demo`

- May use `WalrusWallet` and `./index.css` from `walrus-wallet`.
- Owns consumer example flows through dApp Kit and Wallet Standard feature
  calls.

## Private Packaged Surface

### `@zktx.io/walrus-connect-route-internal`

This workspace package is private. It is the packaged owner for QR/WebRTC
wallet-route UI, lifecycle, route outcomes, sponsored route helpers, and narrow
modal/form primitives consumed by `walrus-wallet`.

Allowed consumers:

- `packages/walrus-wallet/src/internal/walrusConnectRoute.ts`, as the single
  wallet adapter file.
- `packages/walrus-connect` build-time wrappers for the reference signer app,
  without generated public type references to route outcomes or protocol
  declarations.

## Internal Source Surface

- `packages/walrus-connect-route-internal/src` owns QR/WebRTC route source.
- `packages/walrus-connect/src` owns only public reference-signer wrappers,
  public signer-review formatting, public address QR helpers, public types, and
  CSS.
- Protocol implementation source must not be re-exported from
  `packages/walrus-connect/src/wallet-route.ts` or imported from
  `../walrus-connect/src` by the private route package.

## Forbidden Artifact Surface

`@zktx.io/walrus-connect` npm artifacts must not include generated route
declarations. In particular, the tarball must not contain `wallet-route`,
`protocol`, route-only modal/form, QR login/sign host, full `WalrusScan`, route
helper, route lifecycle, route transport, or WebRTC declaration files.

`@zktx.io/walrus-wallet` public declarations must not expose
`@zktx.io/walrus-connect-route-internal`, `walrus-connect/wallet-route`,
`WalrusScan`, `useWalrusScan`, `openSignTxModal`, route outcomes, sponsored
helpers, or protocol declarations.

## Forbidden Surface Verification Matrix

| ID | Forbidden surface | Blocked path | Verifier check |
| --- | --- | --- | --- |
| F-CONNECT-WALLET-ROUTE-EXPORT | `@zktx.io/walrus-connect/wallet-route` public export | package export | `public-export-map` |
| F-CONNECT-PROTOCOL-EXPORT | low-level `@zktx.io/walrus-connect/protocol` public export | package export | `public-export-map` |
| F-APP-ROUTE-SOURCE-IMPORT | `clip` or `demo` importing QR/WebRTC route internals | source import | `app-source-imports` |
| F-WALLET-PUBLIC-CONNECT-IMPORT | `walrus-wallet` importing public `walrus-connect` route surfaces | source import | `wallet-source-imports` |
| F-WALLET-PRIVATE-ADAPTER-SPREAD | direct `@zktx.io/walrus-connect-route-internal` imports outside `walrus-wallet/src/internal/walrusConnectRoute.ts` | source import | `wallet-private-route-adapter` |
| F-CONNECT-ROOT-ROUTE-SOURCE | `walrus-connect` root source exposing QR route hooks, route outcomes, sponsored helpers, or modal openers | source export | `connect-source-public-root` |
| F-SIGNER-APP-FULL-SCAN-SOURCE | `signer-app` source exposing `openSignTxModal`, full `useWalrusScan`, or route outcome errors | source export | `signer-app-source-scan-only` |
| F-WALLET-ROOT-ROUTE-SOURCE | `walrus-wallet` root source exposing route outcome errors | source export | `wallet-source-public-root` |
| F-WALLET-PUBLIC-ROUTE-OUTCOME-TYPES | `walrus-wallet` root source or generated declarations exposing wallet-named aliases of route lifecycle outcomes | source export / generated d.ts | `wallet-public-route-outcome-contract`<br>`wallet-generated-public-dts` |
| F-INTERNAL-SIBLING-SOURCE-REEXPORT | `walrus-connect-route-internal` importing or re-exporting `../walrus-connect/src` | source ownership | `internal-route-source-ownership` |
| F-SIGNER-APP-DTS-MODAL | `signer-app.d.ts` or its import graph exposing `openSignTxModal` | generated d.ts | `signer-app-generated-dts` |
| F-SIGNER-APP-DTS-FULL-SCAN | `signer-app.d.ts` or its import graph exposing full `useWalrusScan` | generated d.ts | `signer-app-generated-dts` |
| F-SIGNER-APP-DTS-ROUTE-OUTCOME | `signer-app.d.ts` or its import graph exposing `QRSignOutcome`, `LoginHostOutcome`, or route protocol declarations | generated d.ts | `signer-app-generated-dts` |
| F-CONNECT-GENERATED-DTS-ROUTE | `walrus-connect/dist/types/**` containing private route source mirrors, protocol declarations, modal/form declarations, or nested source declarations outside the public allowlist | generated d.ts artifact | `connect-generated-dts-artifact` |
| F-CONNECT-PACK-WALLET-ROUTE | `@zktx.io/walrus-connect` tarball containing `dist/types/wallet-route.d.ts` | npm pack artifact | `connect-pack-artifact` |
| F-CONNECT-PACK-PROTOCOL | `@zktx.io/walrus-connect` tarball containing route protocol declarations | npm pack artifact | `connect-pack-artifact` |
| F-CONNECT-PACK-MODAL-FORM | `@zktx.io/walrus-connect` tarball containing route-only modal/form declarations | npm pack artifact | `connect-pack-artifact` |
| F-CONNECT-PACK-ROUTE-ONLY | `@zktx.io/walrus-connect` tarball containing QR login/sign host, full scan provider, sponsored helper, route lifecycle, route transport, or WebRTC declarations | npm pack artifact | `connect-pack-artifact` |
| F-WALLET-PUBLIC-DTS-ROUTE | `walrus-wallet/dist/types/index.d.ts` or its public import graph exposing route internals, route lifecycle variants, or route outcome aliases | generated d.ts | `wallet-generated-public-dts` |
| F-WALLET-GENERATED-DTS-PRIVATE | `walrus-wallet/dist/types/**` containing internal route, private runtime, private component, private state, or private utility declarations outside the public allowlist | generated d.ts artifact | `wallet-generated-dts-artifact` |
| F-WALLET-PACK-PRIVATE-DTS | `@zktx.io/walrus-wallet` tarball containing internal route, private runtime, private component, private state, or private utility declarations | npm pack artifact | `wallet-pack-artifact` |
| F-DOCS-STALE-OUTCOMES | docs mentioning stale route-level outcome error classes as wallet-facing API | docs | `documentation-stale-outcomes` |
| F-VERIFIER-REPEATED-FORBIDDEN-MISS | verifier missing repeated forbidden declaration or tarball artifact matches because a stateful regex was reused | verifier implementation | `verifier-negative-controls` |
| F-SUI-CLIENT-CREATION-SPREAD | runtime import, re-export, dynamic import, `require`, TypeScript import-equals, direct `new SuiClient`, `new SuiGraphQLClient`, `new SuiGrpcClient`, `new SuiJsonRpcClient`, `getFullnodeUrl()`, or `getJsonRpcFullnodeUrl()` outside the wallet/private-route client boundary | source import / construction | `sui-client-boundary-source` |
| F-SUI-TRANSACTION-EXECUTION-SPREAD | direct transaction build/execute/wait/dry-run/simulate/digest calls outside the owner boundary, including dot, bracket, and optional-call forms, except the inventoried public review helper dry-run | source method call | `sui-transaction-execution-boundary` |
| F-SUI-PUBLIC-TYPE-SURFACE-DRIFT | public generated declarations exposing uninventoried Sui, Wallet Standard, or dApp Kit type imports | generated d.ts | `sui-public-type-surface` |

## Behavior Matrix

| Flow | Owner | Allowed inputs | Allowed outputs | Side effects | Failure/cancel/timeout/cleanup | Caller-visible result | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Wallet discovery | `walrus-wallet` registration and `walletCapabilities` | Wallet Standard registry reads wallet-level features before connection | Wallet-level `standard:*`, `sui:signAndExecuteTransaction`, `sui:signTransaction`, and `sui:signPersonalMessage` methods | Local registration only | No network or QR side effect during discovery | `Walrus Clip` is selectable from supported Wallet Standard lists | Installed legacy dApp Kit filter checked; future modern dApp Kit migration must re-check discovery |
| Connect/disconnect | `walletSession` | `standard:connect` / `standard:disconnect` from Wallet Standard provider | Active account list or empty account list | Local account lookup, optional zkLogin nonce modal, optional QR login modal, local storage cleanup on disconnect | Stored network mismatch disconnects; cancel rejects with structured login route error when QR is used; disconnect clears active account and emits change | dApp sees Wallet Standard account changes through `standard:events` | Manual connect/disconnect smoke; network mismatch smoke |
| QR login | `walletSession` invokes private bundled QR route `QRLogin` | `standard:connect` with no local account and no zkLogin nonce callback | Wallet Standard account after validated QR login | Cancellable QR/WebRTC login session; local account storage after success | `WalrusWalletLoginRouteError` on reject/error/timeout; route cleanup unmounts modal/session | `standard:connect` resolves account or rejects with structured wallet login outcome | Manual QR login smoke; no secret logging |
| QR `sui:signAndExecuteTransaction` | `signingRuntime` -> `qrSigningRoute` | Wallet Standard transaction, requested account matching the active Wallet Standard account, matching `sui:<network>` chain, optional sponsor URL | `{ digest, bytes, signature, effects }` | Cancellable QR/WebRTC sign session; possible irreversible external submission by route | Account mismatch throws `WalrusWalletAccountMismatchError`; route failure throws `WalrusWalletQrRouteError` preserving wallet-owned recovery fields and known digest/uncertainty; cancel rejects without submission | dApp receives Wallet Standard sign-and-execute result or structured wallet route error | QR sign smoke; cancel/error smoke; account mismatch test |
| QR pure `sui:signTransaction` | `walletCapabilities` and `signingRuntime` | Wallet Standard signTransaction call while active route has no local signer | No signed transaction | No QR protocol widening; no submission | Rejects with `WalrusWalletFeatureUnavailableError` | Explicit unsupported feature error; wallet remains discoverable | Static call-path review; manual direct sign smoke should confirm clear rejection |
| Local `sui:signTransaction` | `signingRuntime` -> `localSigningRoute` | Wallet Standard transaction, requested account matching the active Wallet Standard account, matching chain, active local zkLogin signer | `{ bytes, signature }` | Password modal; Sui client build of transaction bytes | Account mismatch throws `WalrusWalletAccountMismatchError`; password cancel, expired zkLogin, build/sign errors reject; modal cleanup | Wallet Standard signed transaction result | Direct Wallet Standard sign smoke; account mismatch test |
| Local `sui:signAndExecuteTransaction` | `signingRuntime` -> `localSigningRoute` | Wallet Standard transaction, requested account matching the active Wallet Standard account, matching chain, active local signer, optional sponsor URL | `{ digest, bytes, signature, effects }` | Password modal; local signing; external execution or sponsor execution; confirmation wait | Account mismatch throws `WalrusWalletAccountMismatchError`; pre-submit errors reject normally; post-submit/confirmation uncertainty throws `WalrusWalletTransactionUncertainError` with digest/bytes/signature | Wallet Standard sign-and-execute result or structured uncertainty | Direct sign-and-execute smoke with and without sponsor; account mismatch test |
| Personal message | `signingRuntime` -> `localSigningRoute` | Message bytes, requested account matching the active Wallet Standard account, optional matching chain, active local zkLogin signer | `{ bytes, signature }` | Password modal; local personal-message signing | Account mismatch throws `WalrusWalletAccountMismatchError`; QR-only route throws `WalrusWalletFeatureUnavailableError`; optional chain mismatch throws `WalrusWalletChainMismatchError` | Wallet Standard personal-message result or structured unsupported-route error | Account mismatch test; direct personal-message smoke when UI supports it |
| No-camera scan | `walrus-connect-route-internal` scan providers | Reference signer app or private full scan request with no detected video input | Warning event and settled scan promise | Local UI notification only | No QR/WebRTC session starts; request must not remain pending | Signer or wallet caller can retry after attaching/allowing camera without a hung promise | `walrus-connect` scan regression test |
| Sponsored execution | `localSigningRoute` for local, QR route for QR | Sponsor URL and transaction kind bytes from locally rebuilt transaction | Sponsor-created bytes and digest signed by active route | Irreversible sponsor/execution request after submit | Sponsor execution uncertainty throws structured error with digest; QR path exposes only wallet-owned recovery fields | Digest is preserved whenever sponsor creation or submission produced one | Sponsored path smoke when touched |
| Cancel before submit | `walrus-connect` session lifecycle via wallet route | User closes/cancels before remote submission | No digest, no signature, no effects | Cleanup only | Structured route/login outcome rejects; no pending promise | Caller sees cancellation/error and can retry | Manual cancel smoke |
| Error after submit | `signingRuntime`, `localSigningRoute`, or QR sign runner | Known digest from submitted or sponsor-created transaction | Structured uncertainty error, or final result if confirmed later | Post-effect observation only | `WalrusWalletTransactionUncertainError` or `WalrusWalletQrRouteError` preserves digest/uncertainty | Caller can inspect digest instead of parsing a generic string | Unit/manual simulated post-submit failure; static error type review |
| Network mismatch | `walletSession` | Stored account network differs from current wallet network, or sign request chain mismatches current network | Disconnect on stored mismatch; structured chain mismatch on sign request | Local storage cleanup and Wallet Standard change event for stored mismatch | No signing on wrong chain | Notification plus disconnect, or `WalrusWalletChainMismatchError` | Network mismatch smoke |
| Basic `Coin<T>` helper surface | `walrus-wallet` coin helper and Sui client boundary | Owner address, network, optional coin type | Raw integer balances; formatted display only when metadata exists | Read-only Sui client queries | Metadata failure returns `metadata: null` and `formattedBalance: null`; no inferred decimals | Callers never receive fabricated decimal display amounts | Type/build check; focused helper test should be added when tests are introduced |

## Current Known Gaps

- `WalletStandard` still owns the Wallet Standard object, feature binding, and
  registration-facing getters. Session state is now in `WalletSession`, signing
  orchestration is in `signingRuntime`, route execution is in `signingRoutes`,
  account/chain request validation is in `walletRequestValidation`, and
  caller-visible wallet errors are structured in `walletErrors`.
- `walrus-connect` root exports no longer expose direct QR login/sign hooks,
  sponsored execution, form/modal primitives, or low-level protocol helpers.
  The public `@zktx.io/walrus-connect/wallet-route` subpath has been removed.
  Wallet route internals are bundled into `walrus-wallet` through the private
  workspace-only `@zktx.io/walrus-connect-route-internal` package.
- `clip` and `demo` use the temporary
  `createWalrusWalletDappKitNetworks` helper instead of directly constructing
  provider network maps with `getFullnodeUrl`.
- Basic `Coin<T>` helper behavior is read-only, centralized through
  `walrus-wallet` Sui client helpers, and does not fabricate formatted display
  amounts without metadata.
- Smoke checklist statuses are recorded as not-run with manual execution
  requirements; automated build/test evidence is separate from manual QR smoke.
- SDK 2.x/Core/gRPC migration is intentionally not implemented in this
  baseline. The current boundary fixes owner/gate shape first; unverified
  SDK 2.17.0 API details stay in the inventory until the dependency upgrade
  task.
