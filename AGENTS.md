# AGENTS.md

This file is the root operating contract for coding agents working in this repository. Read it from disk before starting a task.

## Purpose

Walrus Clip is a TypeScript/React kit that registers a Sui Wallet Standard wallet named Walrus Clip for dApps. Its purpose is to let dApps use normal Wallet Standard connect/sign APIs while Walrus Clip routes login, sign, personal-message sign, and sign-and-execute requests to QR/WebRTC air-gapped signing.

dApp developers should integrate Walrus Clip through the supported Wallet Standard registration surface. Users should see and select Walrus Clip as a wallet. QR/WebRTC is an internal signing route, not a dApp-facing protocol.

## Current Direction

This branch is for a breaking modernization. Do not preserve legacy compatibility unless the user explicitly asks for it.

Targets:

- Owner-boundary Sui client construction is on SDK 2.x `SuiGrpcClient` (`@mysten/sui/grpc`) for app-shell client creation, wallet read-only coin helpers, QR review simulation, build/digest/execute/wait, and transaction/personal-message signature-verification paths. JSON-RPC transport (`@mysten/sui/jsonRpc`, `SuiJsonRpcClient`, `getJsonRpcFullnodeUrl`) is removed from source.
- Replace legacy `@mysten/dapp-kit` with the modern dApp Kit packages.
- Move toward React 19.
- Remove Recoil if wallet state can be handled with a smaller local state layer.
- Preserve the current versioned QR/WebRTC protocol baseline unless evidence shows a defect.
- Keep dApp-facing integration centered on Wallet Standard registration and results.

Use `.WORK/ts-sdks` as a read-only reference copy of MystenLabs TypeScript SDKs. Do not edit, format, commit, or depend on files inside `.WORK`.

## Non-Negotiable Boundaries

These boundaries are product constraints, not implementation details:

- Do not add private-key custody, seed phrase handling, or autonomous transaction execution.
- Do not treat AI output, external proposals, QR payloads, or WebRTC messages as executable authority without local validation.
- Do not log or expose private keys, signatures before user approval, or URL fragment secrets.
- Do not silently choose a Sui network, token, route, or transaction sender for the user.
- Do not present testnet, faucet, demo-only, or fake-liquidity flows as production product functionality.
- Do not pass transaction bytes received from another app, MCP client, AI client, or QR/WebRTC peer directly to signing without rebuilding or validating the intended action locally.
- Do not make dApps depend on QR/WebRTC internals. dApps should interact with Walrus Clip through Wallet Standard APIs.
- Do not move dApp-specific product flows, checkout flows, NFT dashboards, kiosk flows, or advanced asset UX into the kit core.

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

## Status And Completion Honesty

Do not overstate progress. Report status from evidence, not intent, confidence,
or the fact that code was edited.

Use these status labels for non-trivial work:

- `planned`: the approach is defined but implementation has not started.
- `partially implemented`: some required code, docs, tests, files, or cleanup are
  still missing.
- `implemented but unverified`: code or docs changed, but one or more required
  checks, boundary reviews, or manual smoke results are missing.
- `verified`: implementation is complete for the agreed scope and the relevant
  automated checks, boundary review, and required manual results are present.
- `blocked`: work cannot continue without a named missing input, decision,
  dependency, permission, or environment.

Do not say `done`, `complete`, `fixed`, or `finished` unless the work is
`verified` and the completion criteria below are met. Passing builds, type
checks, or tests are verification evidence only. They do not prove that behavior,
state ownership, public outcomes, required manual UI/smoke paths, or final
repository status are complete.

If required manual smoke, boundary review, final `git status --short`, generated
or untracked files, or required follow-up edits are missing, report the exact
missing gate and use `partially implemented` or `implemented but unverified`
instead of completion language.

## Defect Classification Language

Use precise defect terms. Do not use security or severity words unless the
evidence supports them. Status labels describe completion state; defect
classifications describe the kind of problem. Always keep them separate.

Allowed defect classifications:

- `security vulnerability`: use only with evidence of unauthorized access,
  secret exposure, signature bypass, transaction authorization bypass,
  injection, privilege escalation, or another exploitable security failure.
- `functional defect`: implemented behavior fails the intended user flow or
  public API contract.
- `compatibility defect`: behavior fails with a supported dependency, wallet
  provider, SDK, browser, or integration path.
- `correctness risk`: behavior can return misleading, lossy, rounded,
  collapsed, ambiguous, or incorrectly formatted data.
- `structural risk`: ownership, module boundaries, state, exports, or
  responsibilities are unclear, but a concrete failing behavior has not yet
  been proven.
- `incomplete implementation`: the accepted plan requires work that is not
  implemented.
- `unverified`: code exists, but required checks, smoke, boundary review, or
  evidence are missing.

Do not call something a `vulnerability`, `security issue`, `unsafe`, or
`critical` unless the report identifies the exploit path, affected actor,
violated boundary, and evidence. If the evidence only shows missing gates,
unclear ownership, broad exports, absent tests, or unfinished refactor work,
classify it as `incomplete implementation`, `structural risk`, or `unverified`,
not as a vulnerability.

Priority is not defect type. A P1 can be an incomplete implementation,
structural risk, compatibility defect, correctness risk, or security
vulnerability. Name both the priority and the classification.

For non-trivial findings, include:

- Status label: `planned`, `partially implemented`, `implemented but
  unverified`, `verified`, or `blocked`.
- Classification: one of the defect classifications above.
- Evidence: file, line, command output, source document, or observed behavior.
- Impact: what user, dApp, wallet, package consumer, or maintainer can observe.
- Why this classification: why the evidence supports this term and not a
  stronger or weaker term.

## Evidence And Decision Standard

- Do not proceed from memory, guesses, or unchecked assumptions.
- Before changing Sui SDK, dApp Kit, Wallet Standard, React, WebRTC, transaction, or signing behavior, verify the relevant facts in the current repo and in the appropriate source of truth.
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

## Completion Process For Non-Trivial Work

For non-trivial work, do not treat implementation as complete because code was
moved, split, renamed, made more abstract, or made to compile. Completion means
the affected invariant is enforced at the correct owner and verified at the
boundary where it matters.

An invariant is a condition that must stay true for the product to remain
correct, such as authorization before signing, one owner for a lifecycle state,
no lost submitted transaction digest, or no leaked secret. A public outcome is
any result, error, event, status, or return value that a caller, user interface,
wallet, dApp, or package consumer can observe and act on.

Before implementation:

- State the invariant that must remain true after the change.
- Identify the single owner for each affected state, side effect, public
  outcome, and cleanup responsibility.
- List the meaningful states, phases, or lifecycle steps affected by the task.
- For each state, phase, or lifecycle step, define the allowed inputs, allowed
  outputs, allowed side effects, failure behavior, timeout behavior, cancel
  behavior, cleanup behavior, and caller-visible outcome.
- Classify side effects by authority and reversibility:
  - read-only;
  - local-only;
  - cancellable async;
  - irreversible external effect;
  - post-effect observation;
  - cleanup;
  - terminal or acknowledgement exception.
- Decide which owner, shared helper, type, or adapter is allowed to run each
  side effect.
- Define verification that would fail if the invariant is broken.

During implementation:

- Do not rely on scattered local checks when a shared owner, type, helper, or
  adapter should enforce the rule.
- Do not make state ownership implicit through booleans spread across
  components, callbacks, stores, or helpers.
- Do not collapse caller-visible outcomes into generic errors or strings when
  callers need distinct recovery behavior.
- If an external effect cannot be safely canceled after it starts, preserve its
  result or uncertainty explicitly.
- If terminal or cleanup behavior has an allowed exception, such as an
  acknowledgement that must still be sent, model that exception explicitly
  instead of bypassing the guard with a catch block.

For source-of-truth or planning updates, including `AGENTS.md`,
`BOUNDARY_INVENTORY.md`, `SMOKE_CHECKLIST.md`, workflows, package manifests, and
`.WORK/` planning notes, run an explicit alignment pass before completion:

- State the target current state before editing.
- Update every surface that claims current status, owner, version, scope,
  verification, or next work.
- Mark historical notes as historical instead of letting them read as current
  guidance.
- Search for stale old versions, old status labels, old touch counts, and
  `next` / `in progress` wording after edits.
- Treat ignored `.WORK/` planning notes as agent inputs even though they are not
  commit artifacts; keep them consistent or clearly superseded.

Before completion:

- Classify the result using the status labels in `Status And Completion
  Honesty`.
- Re-check the implementation against the invariant stated before coding.
- Verify each affected state, phase, or lifecycle step has an implemented path
  for success, failure, timeout, cancel, cleanup, and partial completion when
  applicable.
- Confirm public boundaries still expose the information callers need to make
  correct decisions.
- Confirm the final code structure makes the owner of each state, side effect,
  public outcome, and cleanup responsibility obvious to a new reader.
- Run relevant tests/builds, or state why they could not be run.

## Architecture Boundaries

### `packages/walrus-connect`

Owns the internal QR/WebRTC air-gapped signing route:

- QR display and scanning components.
- PeerJS/WebRTC session lifecycle.
- Versioned protocol message encoding/decoding.
- Login/sign session validation.
- Transport errors, timeouts, cleanup, and relay fallback.

Avoid adding Wallet Standard registration, wallet account storage, dApp transaction creation, dApp product UX, or app-level routing here.

### `packages/walrus-wallet`

Owns Wallet Standard registration and wallet runtime behavior:

- Wallet Standard wallet registration for Walrus Clip advertising `standard:connect`, `standard:disconnect`, `standard:events`, `sui:signAndExecuteTransaction`, `sui:signTransaction`, and `sui:signPersonalMessage`.
- Routing Wallet Standard `sui:signAndExecuteTransaction`, `sui:signTransaction`, and `sui:signPersonalMessage` requests to the QR/WebRTC air-gapped signing route. There is no local signer, zkLogin proof, password modal, or sponsored helper inside this package.
- Sui client integration through a centralized client boundary that constructs `SuiGrpcClient` for the public client helper and the read-only coin helpers.
- Minimal account, connection, QR-backed signing, and basic `Coin<T>` helper surfaces.

Do not create new direct Sui client construction (`SuiJsonRpcClient`, `SuiGraphQLClient`, `SuiGrpcClient`, or legacy `SuiClient`) or fullnode URL helper (`getJsonRpcFullnodeUrl`, legacy `getFullnodeUrl`) call sites. Add or update a client adapter at the wallet or private-route boundary instead. Do not add dApp-specific checkout, NFT dashboard, kiosk, advanced asset UX, or any local signing path here.

### `packages/clip`

Owns the reference Walrus Clip app shell:

- dApp Kit / Wallet Standard provider wiring for the reference app.
- Wallet provider wiring.
- Minimal user-facing connect and scan flows.

Do not move SDK/library responsibilities, QR protocol logic, wallet core logic, OAuth callbacks, or local signer code into this app.

### `packages/demo`

Owns consumer examples:

- QR signing integration examples.
- Optional dApp-specific product examples such as kiosk/payment flows.

Keep demo logic thin. Shared behavior belongs in `walrus-connect` or `walrus-wallet`.

## Sui SDK Rules

- `@mysten/sui@1.x`, `SuiClient`, `getFullnodeUrl`, and the `@mysten/sui/client` legacy JSON-RPC subpath are removed from source and blocked by `scripts/verify-boundary.mjs` as forbidden tokens outside owner files. Do not reintroduce them.
- Owner-boundary Sui client transport is on `@mysten/sui@2.17.0` `SuiGrpcClient` (`@mysten/sui/grpc` subpath) for the public wallet client helper, wallet read-only coin helpers, QR review simulation, QR sign route build/digest/execute/wait, and transaction/personal-message signature-verification paths; baseUrl uses the SDK-documented `https://fullnode.<network>.sui.io:443`. Do not reintroduce JSON-RPC transport or `@mysten/sui/jsonRpc` imports.
- When official docs, `.WORK/ts-sdks`, and installed dependencies disagree, state the discrepancy and follow the source that matches the current task. For active migration work, prefer the target SDK source in `.WORK/ts-sdks`.
- Centralize Sui client creation and network configuration.
- Do not introduce new scattered fullnode URL construction.
- Keep transaction bytes, signatures, digests, and effects handling explicit.
- Pin Sui, wallet, dApp Kit, React, and protocol-sensitive dependencies to explicit versions during modernization work. Commit lockfile changes with dependency changes.

## Numeric And Transaction Safety

- Treat token balances, gas, decimals, raw transaction amounts, slippage, and effects as safety-critical data.
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
- Do not log secrets, private keys, or QR/WebRTC peer credentials.

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
- For each non-trivial finding, state both a status label and a defect
  classification before the evidence.
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

For QR/WebRTC or wallet protocol changes, also provide a manual smoke result
record. If a smoke path was not run, mark it `not run` with the reason. The
record must cover:

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

Do not use completion language when required behavior, affected boundary review,
manual smoke, relevant checks, introduced-error fixes, required files, or final
repository status are missing. Say the precise status instead, for example
`implemented but unverified: QR smoke not run` or `partially implemented:
boundary matrix still incomplete`.

Work is complete only when the requested behavior is implemented, affected
boundaries have been reviewed after the change, relevant checks have been run or
explicitly skipped with a reason, introduced errors have been fixed, required
files are tracked or intentionally ignored, manual smoke results are recorded
when required, and final repository status has been checked.
