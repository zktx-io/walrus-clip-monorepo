# @zktx.io/walrus-connect

`@zktx.io/walrus-connect` contains the public pieces of the Walrus Clip
QR/WebRTC route and the reference signer-app scan surface.

This is **not** the main dApp integration package. Most dApps should install
and integrate `@zktx.io/walrus-wallet`, then use normal Wallet Standard APIs.

## What This Package Exposes

- Passive QR display helpers.
- Transaction review formatting helpers.
- `@zktx.io/walrus-connect/signer-app`, used by the reference Clip signer app
  to scan a QR code and answer login/sign requests.
- Shared CSS for the exposed UI.

## What This Package Does Not Expose

- Wallet Standard registration.
- Wallet account storage.
- dApp-facing QR signing route APIs.
- QR modal launchers for dApps.
- Local signing, zkLogin, or sponsored transaction helpers.

The low-level wallet route is intentionally not published as a public subpath.
It is consumed internally by `@zktx.io/walrus-wallet`.

## Install

```sh
npm install @zktx.io/walrus-connect
```

Peer dependencies are pinned intentionally:

- `@mysten/sui@2.17.0`
- `@mysten/wallet-standard@0.20.3`
- `react@19.2.6`
- `react-dom@19.2.6`

## Signer App Surface

```tsx
import { WalrusSignerScan } from '@zktx.io/walrus-connect/signer-app';
import '@zktx.io/walrus-connect/index.css';
```

The signer app is expected to provide the user's selected Sui account and
signing methods. It should review requests locally before signing.

## ICE / Relay Configuration

The route includes public STUN servers and a test public TURN fallback so local
demos can work in more network environments. That fallback is not a production
service guarantee.

Production apps should provide an `iceConfigUrl` from the app shell. The URL
must serve `{url}/ice-conf.json` with an `iceServers` array and optional
`iceTransportPolicy`. The QR route embeds that config in peer IDs so both sides
attempt the same relay settings.

## Current Limitations

- WebRTC connectivity still depends on browser and network conditions.
- Public relay fallback availability is outside this package's control.
- This package does not promise a stable low-level protocol API.
- DApps should not depend on route internals; use `@zktx.io/walrus-wallet`.
