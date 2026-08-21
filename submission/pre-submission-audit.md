# MeterMesh pre-submission verification audit

Audit date: August 21, 2026

## Verdict

Conditional pass for recording. Fail for final submission readiness until the required later X Layer Mainnet launch is completed or the organizer confirms in writing that it may occur after judging, and until the Google Form is submitted with saved confirmation evidence.

The product itself is stable, testable, truthful about its limits, and strongly tied to X Layer. The recording can use the published signed proof, X Layer explorer transaction, and offline fixture without depending on a fresh live request.

## Artifacts checked

- `AGENTS.md`, `PRD.md`, `design.doc.md`, `architecture.md`, and `research/domain-knowledge.md`
- Public landing page, workspace, documentation, machine manifest, OpenAPI, `llms.txt`, and evidence JSON
- Protocol, chain, AI, XMTP, database, worker, MPP verifier, browser, and contract tests
- X Layer Testnet deployment metadata and fresh read-only contract state
- Public X account and post evidence
- Git tracking, environment ignores, dependency advisories, frontend secret boundaries, and exact local secret values

## Requirement traceability

| PRD requirement                         | Result           | Evidence                                                                                                                                                                                                                       |
| --------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.1 Signed XMTP verification adapter    | Pass             | Real browser and worker delivery was previously proven. Protocol, codec, carrier, state-machine, and database tests cover signatures, wrong bindings, order, duplicates, and replay.                                           |
| 5.2 OKX MPP session integration         | Pass as deferred | Public product creates no session, voucher, settlement, or payment claim. The deterministic published-voucher verifier remains separate from mutation.                                                                         |
| 5.3 AI transaction explainer            | Conditional      | A real successful chain 1952 receipt and Groq explanation are proven. Missing, malformed, wrong-chain, and reverted paths are tested deterministically. A real reverted Testnet transaction explanation has not been captured. |
| 5.4 Buyer-controlled review             | Pass             | Acceptance and rejection remain unsigned browser previews. Duplicate acceptance and invalid delivery bindings fail closed.                                                                                                     |
| 5.5 Durable state and recovery          | Pass             | PostgreSQL integration tests cover idempotency, out-of-order input, durable trial limits, outbox recovery, and duplicate processing. Worker restart and XMTP retry behavior have passed.                                       |
| 5.6 Judge-readable evidence and export  | Pass             | The workspace labels local and live evidence separately. The actual signed live proof is public, cryptographically reverified, and linked to the official Testnet explorer anchor transaction.                                 |
| 5.7 Lean landing page                   | Pass             | One clear promise, one primary action, truthful capability states, and desktop and mobile browser coverage.                                                                                                                    |
| 5.8 Agent-readable documentation        | Pass             | Docs, manifest, OpenAPI, `llms.txt`, schemas, captured fixture, and anchored proof are public and tested as readable GET resources.                                                                                            |
| 5.9 Bounded public trial and Railway    | Pass             | Public web, private worker, PostgreSQL limit, one-wallet reservation, signed refusal, and nonbillable behavior were previously proven. A fresh post-deployment live trial remains part of the deployment gate.                 |
| 5.10 Formal verification-first re-scope | Pass             | Every public payment statement reflects the approved nonbillable scope.                                                                                                                                                        |
| 5.11 Proof-anchor amendment             | Pass             | Four Foundry tests pass. Fresh RPC readback on chain 1952 returns `isAnchored = true` and the expected source transaction for the published evidence hash.                                                                     |

## AGENTS.md three-rule review

1. Thirty-second rule: pass through the public URL. A judge can understand the promise and open the captured verifier without configuration. A new live XMTP request needs an injected EVM wallet and external network services, so the recording should lead with already published proof rather than depend on setup.
2. Chain relevance: pass. The product reads X Layer Testnet receipts, constrains AI output to those facts, commits evidence through a MeterMesh contract on chain 1952, links official explorer evidence, and implements an honest OKX MPP verification boundary.
3. Product quality: pass. The bounded public trial, durable database, recovery behavior, signed protocol, portable proof, public documentation, and failure handling are usable beyond a scripted walkthrough. The offline fixture is plainly labeled and does not pretend to be live.

## Quality gates

- Repository verification: 133 passed, 3 intentional live-network skips.
- Foundry: 4 passed, 0 failed.
- Browser: 10 passed across desktop Chromium and Pixel 5, with 2 gated live-wallet cases skipped in the normal suite.
- Production build: passed.
- Dependency audit: no known production vulnerabilities.
- Read-only X Layer check: chain ID `1952`, anchored state `true`, expected source transaction and deployer returned.
- Public X post: HTTP `200` and verified through X's official embed endpoint with `@XLayerOfficial` and the product link.

## Security review

- `.env`, `.env.*`, wallet state, XMTP state, build output, and browser artifacts are ignored. Only `.env.example` is tracked.
- No environment file appears in repository history.
- Browser production code contains no API key, private key, service secret, passphrase, or server credential.
- AI keys, XMTP worker identity, database credentials, and OKX service credentials remain server-side.
- The staged exact-value scan checked eight local secret values across 138 tracked files and found zero leaks.

## Deviations and scope review

- Completed MPP payment was removed through the approved formal re-scope. The current verifier boundary is covered by the approved MPP interoperability amendment.
- The public signed proof and explorer links complete existing PRD evidence requirements. They do not add a new product feature.
- The dedicated X identity and submission checklist are submission operations, not product scope creep.
- The original demo contract describing funded sessions and settlement is superseded by the approved verification-first re-scope and the current 90-second script.

## Remaining gaps and risks

### Blocking final submission readiness

- X Layer Mainnet launch remains incomplete. Do not claim Mainnet deployment.
- The official Google Form has not been submitted and no confirmation evidence exists.

### Finish before recording

- Deploy this audit fix, then run public desktop, mobile, documentation, anchored-proof, and live XMTP checks.
- Upload the prepared MeterMesh profile image if it is not already visible on `@MeterMesh`.
- Save screenshots of the X post, landing page, workspace with the proof rail open, documentation, and explorer anchor transaction.

### Acceptable disclosed follow-up

- The real successful receipt path is proven, while a real reverted Testnet transaction example remains unproven. Reverted behavior is covered by deterministic unit tests. Do not claim a live reverted example in the recording.
- OKX MPP session mutation for Testnet chain 1952 remains unconfirmed and gated.
