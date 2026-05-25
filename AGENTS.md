# AGENTS.md

This file is the root operating contract for coding agents working in this repository. Read it from disk before starting a task.

## Purpose

Walrus Clip is a TypeScript/React monorepo for a Sui wallet and QR signing experience. It provides zkLogin-based embedded wallet flows, Wallet Standard integration, QR/WebRTC cross-device login and signing, and sponsored transaction UX for Sui dApps.

## Current Direction

This branch is for a breaking modernization. Do not preserve legacy compatibility unless the user explicitly asks for it.

Targets:

- Move from legacy JSON-RPC `SuiClient` usage to Sui SDK 2.x gRPC/Core API patterns.
- Replace legacy `@mysten/dapp-kit` with the modern dApp Kit packages.
- Move toward React 19.
- Remove Recoil if wallet state can be handled with a smaller local state layer.
- Replace ad hoc QR/WebRTC messages with a versioned protocol.

Use `.WORK/ts-sdks` as a read-only reference copy of MystenLabs TypeScript SDKs. Do not edit, format, commit, or depend on files inside `.WORK`.

## Non-Negotiable Boundaries

These boundaries are product constraints, not implementation details:

- Do not add private-key custody, seed phrase handling, or autonomous transaction execution.
- Do not treat AI output, external proposals, QR payloads, or WebRTC messages as executable authority without local validation.
- Do not log or expose JWTs, OAuth tokens, private keys, encrypted key material, proof material, signatures before user approval, or URL fragment secrets.
- Do not silently choose a Sui network, token, route, sponsor, or transaction sender for the user.
- Do not present testnet, faucet, demo-only, or fake-liquidity flows as production product functionality.
- Do not treat sponsored transaction creation as proof that a transaction is safe, affordable, final, or ready for user authorization.
- Do not pass transaction bytes received from another app, MCP client, AI client, or QR/WebRTC peer directly to signing without rebuilding or validating the intended action locally.

## Working Rules

- State assumptions before implementation when the task is ambiguous.
- Inspect the current repository state before editing.
- Inspect `package.json` before running project commands. Do not invent scripts.
- Prefer the smallest correct change that advances the requested goal.
- Do not refactor unrelated code.
- Every changed line must support the current task.
- Mention unrelated issues separately instead of fixing them opportunistically.
- Do not add generic frameworks, broad configurability, or future-proof abstractions unless they simplify this repository now.
- If architecture, security, public API, or data model choices are unclear, stop and ask.
- Keep commits focused. Prefer multiple small commits over one mixed modernization commit.
- Check `git status --short` before the final response and classify unexpected files.

## Evidence And Decision Standard

- Do not proceed from memory, guesses, or unchecked assumptions.
- Before changing Sui SDK, dApp Kit, Wallet Standard, React, WebRTC, zkLogin, transaction, or signing behavior, verify the relevant facts in the current repo and in the appropriate source of truth.
- Use `.WORK/ts-sdks` for Sui SDK facts during modernization work. Prefer local source inspection over memory.
- If package behavior is version-sensitive, inspect the installed package, lockfile, `.WORK/ts-sdks`, or official docs before deciding.
- Clearly separate verified facts, assumptions, and recommendations in plans and reviews.
- Do not make habitual or momentum-based decisions. Before choosing an implementation, look at the whole affected boundary, including callers, callees, user flow, state, errors, tests, and package exports.
- When two directions are plausible, compare them briefly and choose based on the current product purpose and task goal.
- If evidence is incomplete and the decision affects architecture, security, public API, protocol behavior, or signing semantics, stop and ask.

## Scope And Planning

Treat work as non-trivial when it touches multiple packages, changes a public API, changes wallet/signing behavior, changes QR/WebRTC protocol behavior, changes dependency versions, updates lockfiles, or revisits incomplete work.

For non-trivial work:

1. State the product purpose and current task goal.
2. Identify the boundary that must not be crossed.
3. Inspect affected callers, callees, schemas, docs, tests, user flows, and failure paths before editing.
4. Establish a baseline from the user request, accepted plan, current code, and required cleanup found during investigation.
5. Compare reasonable implementation directions when architecture, security, public API, dependency, or protocol meaning is affected.
6. Map each baseline requirement to an implementation surface and verification point.
7. Implement the complete change for the verified boundary.
8. Re-check the affected boundary after the change.

Do not interpret a user request as the lowest-effort literal edit in isolation. Interpret it by the product outcome, affected boundary, and adjacent invariants.

## Architecture Boundaries

### `packages/walrus-connect`

Owns QR/WebRTC UX and transport:

- QR display and scanning components.
- PeerJS/WebRTC session lifecycle.
- Versioned protocol message encoding/decoding.
- Login/sign session validation.
- Transport errors, timeouts, cleanup, and relay fallback.

Avoid adding wallet account storage, zkLogin proof generation, or app-level routing here.

### `packages/walrus-wallet`

Owns embedded wallet behavior:

- zkLogin account creation, proof handling, and signer logic.
- Wallet Standard registration and signing adapter.
- Sui client integration through a centralized client boundary.
- Balances, owned objects, transfers, and sponsored execution.

Do not create new direct `SuiClient` call sites. Add or update a client adapter instead.

### `packages/clip`

Owns the wallet/demo app:

- OAuth callback handling.
- dApp Kit integration.
- Wallet provider wiring.
- User-facing wallet flows.

Do not move SDK/library responsibilities into this app.

### `packages/demo`

Owns consumer examples:

- Kiosk/payment demo.
- QR signing integration examples.

Keep demo logic thin. Shared behavior belongs in `walrus-connect` or `walrus-wallet`.

## Sui SDK Rules

- Treat `@mysten/sui@1.x`, `SuiClient`, `getFullnodeUrl`, and legacy JSON-RPC patterns as migration targets.
- Prefer SDK 2.x gRPC/Core API patterns from `.WORK/ts-sdks` and official Mysten docs.
- When official docs, `.WORK/ts-sdks`, and installed dependencies disagree, state the discrepancy and follow the source that matches the current task. For active migration work, prefer the target SDK source in `.WORK/ts-sdks`.
- Centralize Sui client creation and network configuration.
- Do not introduce new scattered fullnode URL construction.
- Keep transaction bytes, signatures, digests, and effects handling explicit.
- For zkLogin changes, verify current SDK semantics before changing address, nonce, proof, or public identifier logic.
- Pin Sui, wallet, dApp Kit, React, and protocol-sensitive dependencies to explicit versions during modernization work. Commit lockfile changes with dependency changes.

## Numeric And Transaction Safety

- Treat token balances, gas, decimals, raw transaction amounts, sponsor limits, slippage, and effects as safety-critical data.
- Keep raw token amounts as integer strings or `BigInt` values.
- Do not use floating point `number` arithmetic for signable quantities or balance checks.
- Do not infer token decimals from symbols or UI convention. Use SDK metadata or verified onchain metadata.
- Keep display amounts presentation-only unless an explicit raw conversion step validates them.
- Mainnet/product guards must verify both declared network config and the actual connected chain when that information is available.

## QR/WebRTC Protocol Rules

- Use versioned envelopes for protocol messages.
- Validate `version`, `sessionId`, `network`, `type`, and expiry before acting.
- Bind login identity to the signed challenge and verify that public key and address match.
- Ensure every PeerJS session has cleanup for success, error, timeout, and unmount.
- Prevent duplicate scanner events from opening multiple sessions.
- Prefer structured protocol errors over free-form strings.
- Do not log secrets, JWTs, private keys, OAuth tokens, or full proof material.

## Coding Style

- Follow existing TypeScript and React style unless the task is explicitly modernizing it.
- Keep public exports intentional and documented by type names.
- Prefer local helpers over new dependencies when the logic is small.
- Use typed payloads instead of `any` or unvalidated JSON.
- Avoid broad formatting churn.
- Use ASCII unless the existing file requires otherwise.
- Public docs, package README text, user-facing app strings, and repository-visible comments should be English.

## Review Rules

When the user asks for review, prioritize defects over summaries:

- Lead with findings ordered by severity.
- Cite file and line evidence.
- Mark speculation as speculation.
- Check input, state, error, protocol, wallet, and boundary paths. Passing builds are not proof of correctness.
- For refactors, check whether supported behavior, public API, protocol authority, or user-facing claims were unintentionally narrowed.

## Verification

Run the narrowest relevant checks before finishing:

- Install after dependency changes: `npm install`
- Connect package build: `npm run build:connect`
- Wallet package build: `npm run build:wallet`
- Full library build: `npm run build`
- Lint/format only when relevant: `npm run lint`, `npm run format`

If a check cannot be run, report why. If a check fails, report the failing command and the likely cause.

For QR/WebRTC or wallet protocol changes, also provide a manual smoke checklist covering:

- QR login.
- QR sign.
- Sponsored transaction path, if touched.
- Cancel/error path.
- Network mismatch handling, if touched.

## Completion Report

End substantial work with:

- What changed.
- What was verified.
- Any remaining risk or skipped check.

Work is complete only when the requested behavior is implemented, affected boundaries have been reviewed after the change, relevant checks have been run or explicitly skipped with a reason, introduced errors have been fixed, and final repository status has been checked.
