# @zktx.io/walrus-connect

Walrus Connect owns the QR/WebRTC air-gapped signing route used by Walrus Clip.
It is not the dApp integration boundary. dApps should select `Walrus Clip`
through Wallet Standard and call Wallet Standard features.

## Owned Responsibilities

- QR display and scanner UI used by the Clip signing route.
- PeerJS/WebRTC session lifecycle and relay fallback.
- Versioned protocol message encoding/decoding.
- Login and sign session validation.
- Structured transport, timeout, cancel, and cleanup outcomes.

## Not Owned Here

- Wallet Standard registration.
- Wallet account storage.
- Local signing, zkLogin proof generation, or sponsored transaction helpers.
- dApp transaction construction or product flows.
- NFT, checkout, kiosk, or advanced asset UX.

`@zktx.io/walrus-wallet` is the supported dApp-facing package for Wallet
Standard registration/runtime.

## ICE / Relay Configuration

The WebRTC route ships with public STUN servers and a test public TURN relay
fallback so local demos can connect in more NAT configurations. Public relay
availability, quota, and latency are outside this package's control.
The bundled test relay is not a production SLA or security boundary.

Production deployments should pass `iceConfigUrl` from the app shell. The URL
must serve `{url}/ice-conf.json` with an `iceServers` array and optional
`iceTransportPolicy`. When provided, that app-owned ICE config is used before
the bundled default and is embedded in QR peer IDs so both peers use the same
relay configuration.

## Export Policy

- Root package exports are limited to passive display and transaction-review
  helpers. They do not expose QR signing hooks or modal launchers.
- `@zktx.io/walrus-connect/signer-app` is for the reference Clip signer app. It
  exposes scan-only signer-app APIs and must not expose wallet-route modal
  launchers.

There is no public `wallet-route` package subpath. Wallet-route code is consumed
through a private workspace package that is bundled into `@zktx.io/walrus-wallet`.
A dApp-facing integration should depend on `@zktx.io/walrus-wallet` and use
Wallet Standard features.
