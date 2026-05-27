# clip

`clip` is the reference Walrus Clip signer app in this monorepo.

It is a private Vite app, not an npm package. Its job is to show the minimal
user-facing side of the QR/WebRTC flow:

- Connect a normal Sui wallet through modern dApp Kit.
- Scan a Walrus Clip QR code.
- Review a login or transaction request.
- Sign only after the user approves.

This app deliberately does not own the wallet runtime or QR protocol. Shared
behavior belongs in `@zktx.io/walrus-connect` or `@zktx.io/walrus-wallet`.

## Local Development

```sh
npm run dev:clip
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

When set, the app passes the URL to the QR/WebRTC route. The URL must serve
`{url}/ice-conf.json`.

## Current Limitations

- This is a reference app, not a full wallet product.
- It does not provide zkLogin, OAuth callback handling, or sponsored
  transaction support.
- WebRTC reliability depends on camera permission, browser behavior, network
  conditions, and the configured ICE/TURN service.
