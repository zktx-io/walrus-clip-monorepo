# demo

`demo` is a private consumer example for Walrus Clip.

It exists to exercise the dApp-facing side of the kit: a dApp registers the
Walrus Clip wallet surface and sends Wallet Standard requests without importing
QR/WebRTC internals.

This app is not an npm package and is not meant to define product UX for dApps.

## Local Development

```sh
npm run dev:demo
```

or from this directory:

```sh
npm run dev
```

## Configuration

Optional:

```env
VITE_APP_ICE_CONFIG_URL=
```

When set, the app passes the URL to `@zktx.io/walrus-wallet` so the QR/WebRTC
route can use an app-owned ICE/TURN configuration.

## Current Limitations

- This is a thin example, not a production checkout or asset dashboard.
- It does not include sponsored transaction support.
- It should stay small; reusable behavior belongs in the wallet/connect
  packages.
