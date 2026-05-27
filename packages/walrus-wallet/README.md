# @zktx.io/walrus-wallet

`@zktx.io/walrus-wallet` registers **Walrus Clip** as a Sui Wallet Standard
wallet. It is the dApp-facing package in this repository.

The current package is intentionally small. It supports:

- Wallet Standard discovery/connect/disconnect/events.
- QR/WebRTC air-gapped login.
- QR/WebRTC `sui:signAndExecuteTransaction`.
- Basic read-only `Coin<T>` helper queries.

It does not provide local private-key custody, zkLogin proof generation,
password modals, sponsored transaction creation, `sui:signTransaction`, or
`sui:signPersonalMessage`.

This package is still evolving. Treat the `0.4.x` line as a breaking
modernization line, not a long-term stable API promise.

## Install

```sh
npm install @zktx.io/walrus-wallet @zktx.io/walrus-connect
```

Peer dependencies are pinned intentionally:

- `@mysten/sui@2.17.0`
- `@mysten/wallet-standard@0.20.3`
- `react@19.2.6`
- `react-dom@19.2.6`

## Basic Usage

```tsx
import {
  WalrusWallet,
  WALRUS_WALLET_SUPPORTED_NETWORKS,
  createWalrusWalletSuiClient,
} from '@zktx.io/walrus-wallet';
import '@zktx.io/walrus-wallet/index.css';
```

Use the exported network tuple and client factory with your Wallet Standard or
dApp Kit setup. Render `WalrusWallet` once near your app shell so it can
register the wallet and host the QR route UI.

```tsx
<WalrusWallet
  network="testnet"
  iceConfigUrl={import.meta.env.VITE_APP_ICE_CONFIG_URL}
  onEvent={({ variant, message }) => {
    console.log(variant, message);
  }}
>
  {children}
</WalrusWallet>
```

`iceConfigUrl` is optional. When provided, the URL must serve
`{url}/ice-conf.json` with WebRTC ICE server configuration. Production apps
should operate their own short-lived TURN credential service instead of
depending on the bundled public fallback.

## Public Surface

- `WalrusWallet`
- `WALLET_NAME`
- `WALRUS_WALLET_SUPPORTED_NETWORKS`
- `createWalrusWalletSuiClient(network)`
- `getWalrusCoinBalances`
- `getWalrusCoins`
- `formatWalrusCoinAmount`
- `WalrusWalletError` and typed wallet error subclasses
- `WalrusCoinBalance`

The wallet advertises only:

- `standard:connect`
- `standard:disconnect`
- `standard:events`
- `sui:signAndExecuteTransaction`

## Boundaries

QR/WebRTC is an internal signing route. dApps should not import route internals
or launch QR modals directly. Use Wallet Standard features.

The public Sui client helper remains JSON-RPC-compatible because dApp Kit and
the coin helpers still depend on that shape. Transaction build, execution,
finality, and signature verification for the QR route live behind the internal
route owner.

## Current Limitations

- No local signing path.
- No zkLogin or OAuth callback flow.
- No sponsored transaction helper.
- No production guarantee for the bundled public ICE/TURN fallback.
- Manual QR smoke testing is still important for release validation because
  WebRTC behavior depends on browser, network, and relay conditions.
