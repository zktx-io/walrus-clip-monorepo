# Walrus Clip Boundary Inventory

This file is the source of truth for the current boundary gate. It does not
replace `AGENTS.md`; it maps each allowed and forbidden surface to automated
verification in `scripts/verify-boundary.mjs`.

## Product Boundary

The dApp-facing boundary is `@zktx.io/walrus-wallet` Wallet Standard
registration/runtime. External dApps must not be able to integrate directly
with the QR/WebRTC wallet route through package exports, source imports,
generated declarations, or npm tarball artifacts.

The current product surface is intentionally narrow:

- Wallet Standard registration of `Walrus Clip`.
- Air-gapped QR/WebRTC `standard:connect` (login).
- Air-gapped QR/WebRTC `sui:signAndExecuteTransaction`.
- Air-gapped QR/WebRTC `sui:signTransaction`.
- Air-gapped QR/WebRTC `sui:signPersonalMessage`.
- Wallet-side account/network validation and structured wallet/QR errors.

Removed from the public surface:

- zkLogin account/proof/signer and the in-wallet password modal.
- Enoki/OAuth callback flow and `useWalrusWallet().updateJwt`.
- Sponsored transaction creation/execution helpers and the `sponsoredUrl`
  prop on `WalrusWallet`.

## Sui Client Boundary Baseline

Current status: `@mysten/sui@2.17.0` and `@mysten/wallet-standard@0.20.3` are
installed. The wallet boundary (`packages/walrus-wallet`) and QR sign route
owner (`packages/walrus-connect-route-internal`) construct `SuiGrpcClient`
(from `@mysten/sui/grpc`) only. JSON-RPC transport
(`@mysten/sui/jsonRpc`, `SuiJsonRpcClient`, and `getJsonRpcFullnodeUrl`) is
removed from source. Wallet Standard caller-visible signing flows still route
through the QR sign host runner instead of a local signer.

Modern dApp Kit (`@mysten/dapp-kit-react@2.0.3`,
`@mysten/dapp-kit-core@1.3.2`) is installed in `clip` and `demo`;
`walrus-wallet` no longer depends on any dApp Kit package and exposes the
network tuple + Sui client factory the app shell consumes.
`.WORK/ts-sdks/packages/sui/package.json` is the in-tree SDK source
reference.

Invariant: Sui client construction, fullnode URL selection, transaction
build, transaction execution, transaction finality wait, and route
simulation calls must stay behind a package owner boundary. New client
families must enter through the same wallet/private-route owner files, not
through scattered consumer code. Wallet Standard caller-visible results must
preserve the fields that belong to each public outcome:
`sui:signAndExecuteTransaction` preserves `digest`, `bytes`, `signature`,
`effects`, and explicit finality uncertainty, while `sui:signTransaction` and
`sui:signPersonalMessage` preserve `bytes` and `signature` instead of
collapsing outcomes into generic strings.

Owners:

- `packages/walrus-wallet/src/utils/suiClient.ts` owns the public
  `SuiGrpcClient` factory (`createWalrusWalletSuiClient`) consumed by dApp Kit
  `createClient` wiring and the wallet read-only coin helpers. It does not
  build, execute, or wait for transactions.
- `packages/walrus-connect-route-internal/src/utils/suiClient.ts` owns
  private QR/WebRTC route Sui client creation, transaction build, digest
  calculation, review simulation, execution, and finality wait.
- `packages/clip` and `packages/demo` own modern dApp Kit provider wiring
  (`createDAppKit`, `<DAppKitProvider>`) and consume
  `WALRUS_WALLET_SUPPORTED_NETWORKS` + `createWalrusWalletSuiClient` from
  `@zktx.io/walrus-wallet`; they must not construct Sui clients or
  fullnode URL maps directly.
- `packages/walrus-connect/src/utils/signTransactionReview.ts` remains a
  temporary public review helper that can simulate through an injected
  `SuiGrpcClient`. It is inventoried as a narrow public exception, not as a
  new owner.

### Sui Usage Inventory

| Surface | Current repo usage | Owner | Status | SDK 2.17.0 current fact | Gate |
| --- | --- | --- | --- | --- | --- |
| `@mysten/sui/jsonRpc` / `SuiJsonRpcClient` / `getJsonRpcFullnodeUrl` | none allowed in source or public generated declarations | n/a | removed; verifier blocks reintroduction | SDK 2.17.0 Core/gRPC paths are now the only Sui transport used by this repo | `sui-client-boundary-source` |
| `SuiGrpcClient` runtime construction | wallet public client helper, wallet coin helpers, private QR route build/digest/execute/wait/review simulation, and transaction/personal-message signature-verification path; baseUrl uses the SDK-documented `https://fullnode.<network>.sui.io:443` per `.WORK/ts-sdks/packages/sui/README.md:75-81` | wallet + private route client boundaries | implemented but unverified; transport viability proof recorded in `scripts/verify-sui-grpc-transport.mjs`, and QR login/sign/reject browser smoke is user-reported pass on 2026-05-27; network mismatch and disconnect smoke under the narrowed product scope remain unrecorded | SDK 2.17.0 exposes `SuiGrpcClient` from `@mysten/sui/grpc` with `{ network, baseUrl }`; no `getGrpcFullnodeUrl` helper exists, so baseUrl is owned inside the owner files as constant tuples | `sui-client-boundary-source` |
| `SuiGraphQLClient` | not constructed by wallet, QR route, or app shells | n/a | retired from runtime boundary; defensive ban retained | QR route signature verification now passes the gRPC owner client (`ClientWithCoreApi`) to `verifyTransactionSignature` / `verifyPersonalMessageSignature` instead of constructing a GraphQL client; no source imports `@mysten/sui/graphql` today | `sui-client-boundary-source` retains the `new SuiGraphQLClient` construction ban and the `@mysten/sui/graphql` runtime-import scan defensively, so a future regression that re-introduces a GraphQL transport outside the owner files fails the gate |
| dApp Kit provider network config | `clip` and `demo` own modern dApp Kit `createDAppKit({ networks, createClient, slushWalletConfig: null })`; `walrus-wallet` exposes `WALRUS_WALLET_SUPPORTED_NETWORKS` + `createWalrusWalletSuiClient` only | app shell owns dApp Kit provider; wallet exposes networks tuple + client factory | landed in `e13f981 refactor(app): migrate to modern dapp kit`; user smoke deferred | modern dApp Kit core derives chain from current client; the legacy `createWalrusWalletDappKitNetworks` helper is no longer present | `sui-client-boundary-source` |
| `executeTransactionBlock` | banned at runtime everywhere outside owner files; the private QR route owner calls `client.core.executeTransaction({ transaction, signatures })` on `SuiGrpcClient` and unwraps the `TransactionResult` `$kind` discriminant to preserve digest on success and on `FailedTransaction` | private route client boundary | adapter migrated to Core API on gRPC transport | SDK 2.17.0 Core method is `executeTransaction({ transaction: Uint8Array, signatures })`; `SuiGrpcClient.core.executeTransaction` shares the `parseTransaction` pipeline with `waitForTransaction` so the adapter sequence (execute returns digest, separate wait reads effects.bcs) is unchanged | `sui-transaction-execution-boundary` |
| `waitForTransaction` | private QR route owner adapter calls `client.core.waitForTransaction({ digest, include: { effects: true }, timeout })` on `SuiGrpcClient` and extracts `Transaction.effects.bcs` as the raw effects byte payload; missing `effects.bcs` is a failing condition that surfaces as a typed uncertainty error from the caller | private route client boundary | adapter migrated to Core API on gRPC transport | SDK 2.17.0 Core `waitForTransaction` uses `include` flags and exposes raw effects bytes at `Transaction.effects.bcs`; gRPC populates it from `effects.bcs?.value` | `sui-transaction-execution-boundary` |
| `simulateTransaction` | private route review via boundary wrapper; public review helper temporary exception | private route client boundary; public helper exception | migrated to Core API on gRPC transport | SDK 2.17.0 Core simulation returns a transaction-result union; review facts are mapped from balance changes, effects changed objects, and events | `sui-transaction-execution-boundary` |
| `Transaction` build/from/toJSON/getDigest | private QR route, public review helper, demo kiosk | private route for runtime build; private route client boundary owns digest calculation; protocol validation owns digest comparison | keep temporarily | SDK 2.17.0 exports `Transaction`, `Transaction.from`, `toJSON`, `build`, and `getDigest` with the same call shape as SDK 1.x; serialized v2 data and supported intents pass through `SuiGrpcClient` build/digest under the owner boundary | `sui-transaction-execution-boundary` for build and digest |
| zkLogin SDK imports | none in the wallet or app shell runtime; Clip signer-app keeps standard Ed25519/Secp256k1/Secp256r1/MultiSig/Passkey public-key dispatch only | n/a | retired with the zkLogin signer removal | no source imports `@mysten/sui/zklogin`; the wallet stores no zkLogin proof material, generates no nonce, and never opens a password modal | source scan |
| Wallet Standard `sui:signAndExecuteTransaction` input/output types | wallet runtime and private/public signer types | wallet runtime public outcome boundary | installed on `@mysten/wallet-standard@0.20.3` | feature output `{ bytes, signature, digest, effects }` (base64 BCS effects) is preserved by the wallet runtime and QR sign host | wallet public outcome tests + boundary scans |
| read-only coin helpers | `getWalrusCoinBalances` and `getWalrusCoins` through wallet gRPC client helper | wallet read-only helper surface | migrated to Core API on gRPC transport | implemented through `SuiGrpcClient.core.listBalances`, `listCoins`, and `getCoinMetadata`; JSON-RPC-only fields such as `lockedBalance` and `CoinStruct.previousTransaction` are not fabricated | wallet helper tests |

Owner-internal QR route call paths now use the unified Core API
(`client.core.simulateTransaction`, `client.core.executeTransaction`,
`client.core.waitForTransaction`, and `ClientWithCoreApi` for signature
verification) against `SuiGrpcClient` transport. The wallet public client
factory and read-only coin helpers also use `SuiGrpcClient`. This is a
breaking API narrowing for helper surfaces that previously exposed
JSON-RPC-only fields.

## Public Surface

### `@zktx.io/walrus-wallet`

- `WalrusWallet`: registers the Wallet Standard wallet and hosts the QR/WebRTC
  signing route UI. Accepts an optional `onLogout?: () => void | Promise<void>`
  prop with override semantics: when set, the action drawer's logout button
  awaits `onLogout()` (and does not call the wallet's own
  `standard:disconnect`); when unset, the drawer falls back to calling
  `standard:disconnect.disconnect()` directly. App shells using modern dApp
  Kit pass `onLogout={() => dAppKit.disconnectWallet()}` so exactly one
  wallet disconnect runs per logout. The `sponsoredUrl` and `zklogin` props
  have been removed.
- `WALLET_NAME`: Wallet Standard display name.
- `./index.css`: wallet provider styles.
- `getWalrusCoinBalances`, `getWalrusCoins`, `formatWalrusCoinAmount`, and
  `WalrusCoinBalance`: read-only basic `Coin<T>` helper surface backed by the
  wallet Sui client boundary.
- `WALRUS_WALLET_SUPPORTED_NETWORKS` (`readonly ['mainnet', 'testnet', 'devnet']`)
  and `createWalrusWalletSuiClient(network)`: network tuple and `SuiGrpcClient`
  factory consumed by app-shell `createDAppKit` calls.
- `WalrusWalletError` and typed subclasses: caller-visible recovery contract
  for account mismatch, network mismatch, unsupported features, QR/login
  route failures. These errors expose wallet-owned recovery fields only, not
  route lifecycle outcome unions.

### `@zktx.io/walrus-connect`

- Root export: `QRAddress`, `QRAddressScan`, `formatSignTransactionReview`,
  `NETWORK`, `NotiVariant`, `ClipSigner`, and `SignTransactionReview`.
- `./signer-app` export: `WalrusSignerScan`, `useWalrusSignerScan`,
  `formatSignTransactionReview`, `ClipSigner`, `NETWORK`, `NotiVariant`, and
  `SignTransactionReview`.
- `./index.css`: shared QR/reference signer styles.

### `packages/clip`

- May use `WalrusWallet`, `WALLET_NAME`,
  `WALRUS_WALLET_SUPPORTED_NETWORKS`, and `createWalrusWalletSuiClient` from
  `walrus-wallet`.
- May use `WalrusSignerScan`, `useWalrusSignerScan`, and
  `formatSignTransactionReview` only for the reference signer app scan flow.
- Owns modern dApp Kit provider wiring (`createDAppKit({ ...,
  slushWalletConfig: null })`, `<DAppKitProvider>`, `useCurrentNetwork`,
  `useDAppKit`). The OAuth callback route and `useWalrusWallet().updateJwt`
  helper have been removed.

### `packages/demo`

- May use `WalrusWallet`, `./index.css`, `WALRUS_WALLET_SUPPORTED_NETWORKS`,
  and `createWalrusWalletSuiClient` from `walrus-wallet`.
- Owns consumer example flows through modern dApp Kit (`createDAppKit`,
  `<DAppKitProvider>`) and the Wallet Standard
  `sui:signAndExecuteTransaction` feature.

## Private Packaged Surface

### `@zktx.io/walrus-connect-route-internal`

This workspace package is private. It is the packaged owner for QR/WebRTC
wallet-route UI, lifecycle, route outcomes, and narrow modal/form primitives
consumed by `walrus-wallet`.

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
| F-SUI-CLIENT-CREATION-SPREAD | runtime import, re-export, dynamic import, `require`, TypeScript import-equals, direct `new SuiClient`, `new SuiGraphQLClient`, `new SuiGrpcClient`, `new SuiJsonRpcClient`, `getFullnodeUrl()`, or `getJsonRpcFullnodeUrl()` outside the wallet/private-route client boundary; any `@mysten/sui/jsonRpc` source import anywhere | source import / construction | `sui-client-boundary-source` |
| F-SUI-TRANSACTION-EXECUTION-SPREAD | direct transaction build/execute/wait/simulate/digest calls outside the owner boundary, including dot, bracket, and optional-call forms, except the inventoried public review helper Core simulation | source method call | `sui-transaction-execution-boundary` |
| F-SUI-PUBLIC-TYPE-SURFACE-DRIFT | public generated declarations exposing uninventoried Sui, Wallet Standard, or dApp Kit type imports | generated d.ts | `sui-public-type-surface` |

## Behavior Matrix

| Flow | Owner | Allowed inputs | Allowed outputs | Side effects | Failure/cancel/timeout/cleanup | Caller-visible result | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Wallet discovery | `walrus-wallet` registration and `walletCapabilities` | Wallet Standard registry reads wallet-level features before connection | Wallet-level and account-level `standard:connect`, `standard:disconnect`, `standard:events`, `sui:signAndExecuteTransaction`, `sui:signTransaction`, and `sui:signPersonalMessage` | Local registration only | No network or QR side effect during discovery | `Walrus Clip` is selectable from modern dApp Kit lists; QR-backed account features expose sign-and-execute, sign-only, and personal-message signing | Modern dApp Kit `signingFeatures` filter checked in installed source; wallet capability test |
| Connect/disconnect | `walletSession` | `standard:connect` / `standard:disconnect` from Wallet Standard provider | Active account list or empty account list | Local account lookup, QR login modal, local storage cleanup on disconnect | Stored network mismatch disconnects; cancel rejects with structured login route error when QR is used; disconnect clears active account and emits change | dApp sees Wallet Standard account changes through `standard:events` | Manual connect/disconnect smoke; network mismatch smoke |
| QR login | `walletSession` invokes private bundled QR route `QRLogin` | `standard:connect` with no local account | Wallet Standard account after validated QR login | Cancellable QR/WebRTC login session; local account storage after success | `WalrusWalletLoginRouteError` on reject/error/timeout; route cleanup unmounts modal/session | `standard:connect` resolves account or rejects with structured wallet login outcome | Manual QR login smoke; no secret logging |
| QR `sui:signAndExecuteTransaction` | `signingRuntime` -> `signAndExecuteTransactionWithQrRoute` | Wallet Standard transaction, requested account matching the active Wallet Standard account, matching `sui:<network>` chain | `{ digest, bytes, signature, effects }` | Cancellable QR/WebRTC sign session; possible irreversible external submission by route | Account mismatch throws `WalrusWalletAccountMismatchError`; route failure throws `WalrusWalletQrRouteError` preserving wallet-owned recovery fields and known digest/uncertainty; cancel rejects without submission | dApp receives Wallet Standard sign-and-execute result or structured wallet route error | QR sign smoke; cancel/error smoke; account mismatch test |
| QR `sui:signTransaction` | `signingRuntime` -> `signTransactionWithQrRoute` | Wallet Standard transaction, requested account matching the active Wallet Standard account, matching `sui:<network>` chain | `{ bytes, signature }` | Cancellable QR/WebRTC sign session; no transaction submission | Account mismatch throws `WalrusWalletAccountMismatchError`; route failure throws `WalrusWalletQrRouteError`; cancel rejects before submission because there is no submission phase | dApp receives Wallet Standard signed transaction result or structured wallet route error | QR sign-only smoke; wallet capability test; protocol host/scanner tests |
| QR `sui:signPersonalMessage` | `signingRuntime` -> `signPersonalMessageWithQrRoute` | Wallet Standard message bytes, requested account matching the active Wallet Standard account, optional matching `sui:<network>` chain | `{ bytes, signature }` | Cancellable QR/WebRTC personal-message sign session; no transaction build or submission | Account mismatch throws `WalrusWalletAccountMismatchError`; route failure throws `WalrusWalletQrRouteError`; cancel rejects before signing result | dApp receives Wallet Standard signed personal message result or structured wallet route error | QR personal-message smoke; wallet capability test; protocol host/scanner tests |
| No-camera scan | `walrus-connect-route-internal` scan providers | Reference signer app or private full scan request with no detected video input, unsupported camera APIs, or denied camera permission | Error event and settled scan promise | Local UI notification only | No QR/WebRTC session starts; request must not remain pending | Signer or wallet caller sees a camera error and can retry after attaching/allowing camera without a hung promise | `walrus-connect` scan regression test |
| Cancel before submit | `walrus-connect` session lifecycle via wallet route | User closes/cancels before remote submission | No digest, no signature, no effects | Cleanup only | Structured route/login outcome rejects; no pending promise | Caller sees cancellation/error and can retry | Manual cancel smoke |
| Error after submit | QR sign runner | Known digest from submitted transaction | Structured uncertainty error, or final result if confirmed later | Post-effect observation only | `WalrusWalletQrRouteError` preserves digest/uncertainty | Caller can inspect digest instead of parsing a generic string | Unit/manual simulated post-submit failure; static error type review |
| Network mismatch | `walletSession` | Stored account network differs from current wallet network, or sign request chain mismatches current network | Disconnect on stored mismatch; structured chain mismatch on sign request | Local storage cleanup and Wallet Standard change event for stored mismatch | No signing on wrong chain | Notification plus disconnect, or `WalrusWalletChainMismatchError` | Network mismatch smoke |
| Basic `Coin<T>` helper surface | `walrus-wallet` coin helper and Sui client boundary | Owner address, network, optional coin type | Raw integer balances from Core API; formatted display only when metadata exists | Read-only Sui client queries | Metadata failure returns `metadata: null` and `formattedBalance: null`; no inferred decimals | Callers never receive fabricated decimal display amounts or JSON-RPC-only fields | Type/build check; focused helper tests cover integer formatting, null metadata, and malformed raw balances |

## Current Known Gaps

- `WalletStandard` still owns the Wallet Standard object, feature binding,
  and registration-facing getters. Session state is now in `WalletSession`,
  signing orchestration is in `signingRuntime`, route execution is in
  `signingRoutes`, account/chain request validation is in
  `walletRequestValidation`, and caller-visible wallet errors are
  structured in `walletErrors`. The wallet runtime no longer carries local
  zkLogin signing, password modal, sponsored helpers, or sponsored uncertainty
  phases.
- `walrus-connect` root exports no longer expose direct QR login/sign hooks,
  sponsored execution, form/modal primitives, or low-level protocol
  helpers. The public `@zktx.io/walrus-connect/wallet-route` subpath has
  been removed. Wallet route internals are bundled into `walrus-wallet`
  through the private workspace-only
  `@zktx.io/walrus-connect-route-internal` package.
- `clip` and `demo` construct their modern dApp Kit instance via
  `createDAppKit({ networks: [...WALRUS_WALLET_SUPPORTED_NETWORKS],
  createClient: createWalrusWalletSuiClient, slushWalletConfig: null,
  ... })`; they do not build provider network maps directly. `clip` no longer hosts an OAuth callback route or
  `query-string`/`react-router-dom` dependencies.
- Basic `Coin<T>` helper behavior is read-only, centralized through
  `walrus-wallet` Sui client helpers, and does not fabricate formatted
  display amounts without metadata.
- Smoke checklist entries beyond QR login and QR sign approve are
  recorded as not-run with manual execution requirements; automated
  build/test evidence is separate from manual QR smoke.
- `@mysten/sui@2.17.0` and `@mysten/wallet-standard@0.20.3` are installed.
  The private route client boundary constructs `SuiGrpcClient` for
  build/digest/execute/finality/signature-verification and review simulation.
  The wallet boundary constructs `SuiGrpcClient` for the public client helper
  and coin helpers.
  `@mysten/dapp-kit-react@2.0.3` and `@mysten/dapp-kit-core@1.3.2` are
  installed in `clip` and `demo`; the legacy `@mysten/dapp-kit@0.18.0`
  peer-dep on `walrus-wallet` is removed. Transitive
  `@mysten/slush-wallet@1.0.5` deduplicates against the root
  `@mysten/sui@2.17.0`. Auto-registration of Slush in the dApp Kit
  instance is disabled via `slushWalletConfig: null`.
- SDK 2.x publishes ESM-only types via `exports.types.import` (`.d.mts`).
  The three library workspaces (`packages/walrus-wallet`,
  `packages/walrus-connect`, `packages/walrus-connect-route-internal`)
  therefore use `"moduleResolution": "bundler"` in their `tsconfig.json`
  so the Rollup/Vite-based build chain reads the SDK `exports` field.
  `clip` and `demo` already use the same setting through
  `tsconfig.app.json`. Reverting any library tsconfig to `"node"` will
  reintroduce the `TS2307: Cannot find module '@mysten/sui/<subpath>'`
  build failure against SDK 2.x.
