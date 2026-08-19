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

MeterMesh is under active hackathon development. The public issue history records meaningful features and architectural decisions as they are implemented and verified.

## Local requirements

- Node.js 22 or newer
- pnpm 10
- PostgreSQL for application state once the storage issue begins

Install and run the baseline checks:

```bash
pnpm install
pnpm verify
```

Copy `.env.example` to a local ignored environment file when a feature needs external services. Never commit wallet keys or service credentials.
