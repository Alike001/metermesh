# MeterMesh

AI work over messages, paid only when the buyer accepts it.

MeterMesh connects XMTP-delivered AI work to buyer-signed OKX MPP payment vouchers on X Layer. A buyer funds one capped payment session, requests a transaction explanation, and advances the cumulative payment only after a valid delivery is accepted.

## Why it matters

Long-running agents need a payment model that survives delayed messages, retries, duplicate delivery, and process restarts. MeterMesh binds each accepted work unit to a deterministic protocol envelope and a buyer-signed cumulative voucher. Rejected or replayed deliveries cannot increase the amount owed.

## V1 proof

- One X Layer transaction-explainer service
- One funded OKX MPP session
- Requests and deliveries carried through XMTP
- Buyer-controlled acceptance and rejection
- Replay-safe cumulative vouchers
- Final settlement on X Layer
- Portable evidence for live and offline judging

## Status

The deterministic protocol kernel, durable PostgreSQL recovery layer, landing page, and Protocol Conversation workspace are implemented and tested. The frontend exposes the exact relationship between a request, delivery, buyer review, amount owed, and settlement gate.

The checked-in session evidence is an offline local protocol record. It clearly states that no AI-provider response, network call, or movement of funds occurred. OKX Service Account authentication and the read-only MPP status route are verified. X Layer Testnet session mutation remains disabled until OKX confirms MPP session support for chain `1952`.

## Local requirements

- Node.js 22 or newer
- pnpm 10
- Docker or another Testcontainers-compatible runtime for the PostgreSQL integration suite

## Run the product

Install dependencies and start the frontend:

```bash
pnpm install
pnpm --filter @metermesh/web dev
```

Open `http://localhost:5173`. The landing page explains the product, and `Open metered session` enters the complete browser-tested workspace.

## Verify the build

```bash
pnpm verify
pnpm --filter @metermesh/web test:e2e
```

The full verification suite runs formatting, strict lint, TypeScript checks, protocol tests, frontend interaction tests, and PostgreSQL 17 integration tests. The Playwright suite builds the current frontend first, then runs the main product flow and evidence export in desktop and mobile Chromium.

Copy `.env.example` to a local ignored environment file when an external integration needs credentials. Keep wallet keys and service credentials out of commits and browser code.
