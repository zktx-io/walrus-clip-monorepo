# @zktx.io/walrus-connect-route-internal

`@zktx.io/walrus-connect-route-internal` is a private workspace package.

It holds the QR/WebRTC wallet route implementation that is bundled into
`@zktx.io/walrus-wallet`. It is not published as a dApp-facing API and should
not be imported by application code.

## Owned Responsibilities

- QR login and sign host UI used by the wallet runtime.
- PeerJS/WebRTC session lifecycle.
- Versioned login/sign protocol messages.
- Transaction review, sender validation, digest/effects preservation, and
  structured route outcomes.
- Sui client construction for the private QR route owner.

## Not Owned Here

- Wallet Standard registration.
- Wallet account storage.
- dApp product UX.
- Local signing, zkLogin, OAuth, or sponsored transaction helpers.

## Current Limitations

- This package is private because the route boundary is still an internal
  implementation detail.
- The protocol should remain versioned and tested before any public exposure is
  considered.
- WebRTC behavior still needs manual smoke coverage for release confidence.
