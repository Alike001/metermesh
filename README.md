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

The deterministic protocol kernel, durable PostgreSQL recovery layer, landing page, and Protocol Conversation workspace are implemented and tested. A fresh browser wallet has also completed the real XMTP dev path through the Node worker, a live X Layer Testnet receipt, strict AI output, and a signed delivery verified in the browser.

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

## Railway deployment

The repository contains separate Railway configuration files for the public web service and private worker:

- `/deploy/railway.web.json`
- `/deploy/railway.worker.json`

Create two services from this GitHub repository and one Railway PostgreSQL service. Keep both code-service root directories at `/`, then set each service's absolute Railway config path to its matching file. Generate a public domain only for the web service. Keep the worker at one replica with no public domain.

Set the worker's `DATABASE_URL` to `${{Postgres.DATABASE_URL}}`. Add the server-only XMTP, Groq, and X Layer values from `.env.example` directly to the worker service. For the bounded judge path, also set:

```dotenv
METERMESH_ALLOW_UNFUNDED_XMTP_WORK=1
METERMESH_XMTP_ACCESS_MODE=public-trial
METERMESH_TRIAL_GLOBAL_LIMIT=50
```

The first trial limit written to PostgreSQL is immutable through normal startup. Changing the environment value later makes the worker fail closed until an explicit database decision reconciles it. Each wallet receives one reserved request, duplicate processing consumes no additional slot, and the global limit bounds total AI work. This trial never creates a payment voucher or moves funds.
