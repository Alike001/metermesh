# MeterMesh 90-second judge demo

This script follows the published AI Season dimensions: AI application, innovation, product completeness, user value, X Layer integration, growth potential, and ecosystem contribution. It presents only capabilities that are live or independently verifiable.

## 0:00-0:10, the problem and product

Show the MeterMesh landing page.

Say: “AI agents can deliver useful work over messages, but the buyer still has to trust that the result belongs to the request and the chain evidence. MeterMesh lets the buyer verify the request, delivery, result, and X Layer evidence together before deciding whether the work is useful.”

Judging signal: user value, product clarity, innovation.

## 0:10-0:25, one real X Layer request

Open the workspace and point to the real X Layer Testnet transaction hash. Show the request boundary before any AI result appears.

Say: “The buyer chooses one real X Layer transaction. The signed XMTP request binds this work unit to that transaction hash, so the agent cannot quietly explain a different transaction.”

Judging signal: X Layer integration, verifiability.

## 0:25-0:42, AI delivery with chain facts separated from model text

Show the delivery timeline and structured explanation.

Say: “The worker reads the receipt from X Layer, normalizes status, value, fees, addresses, and logs, then asks the AI provider for structured explanation. The model writes the prose. It does not invent the chain facts or authorize payment. The seller signs the delivery and its canonical result hash.”

Judging signal: AI application, data quality, technical depth.

## 0:42-0:57, buyer acceptance and tamper proof

Click the acceptance preview, then open Protocol details or the evidence export.

Say: “The buyer can preview an accept or reject decision. That decision stays local and unsigned in v1, so it cannot create a voucher or payment claim. Change the transaction, result, signature, or sequence and the verifier rejects the bundle.”

Judging signal: product completeness, verifiability, user control.

## 0:57-1:10, X Layer-owned proof anchor

Show the proof anchor entry and the public X Layer transaction reference. If connectivity is uncertain, use the captured proof screenshot and the checked-in deployment metadata.

Say: “The same deterministic evidence hash is committed by MeterMesh's proof-anchor contract on X Layer Testnet. The public transaction and readback prove that this evidence commitment exists independently of the frontend.”

Judging signal: X Layer integration, ecosystem contribution, verifiability.

## 1:10-1:22, recovery and machine-readable surface

Show `/docs/` or `/.well-known/metermesh.json` briefly.

Say: “This is built for agents and builders too. The protocol schema, OpenAPI read surfaces, machine manifest, and portable evidence make the workflow inspectable. XMTP retries, PostgreSQL outbox recovery, and replay checks protect the same proof when delivery is delayed or duplicated.”

Judging signal: scalability, growth potential, ecosystem contribution.

## 1:22-1:30, honest MPP boundary and close

Show the MPP capability status with the verifier marked verified and Testnet mutation marked gated.

Say: “MeterMesh also includes a deterministic verifier for OKX's published MPP EIP-712 voucher shape. It checks signer, chain, escrow, cap, cumulative amount, and replay safety. OKX has not confirmed session mutation for Testnet chain 1952, so MeterMesh does not fake a payment. The value is verifiable AI work over X Layer, with settlement ready to plug in when the chain support is official.”

Judging signal: ecosystem fit, product honesty, technical depth.

## Demo safety

- Primary path: use the prerecorded live-proof capture and public deployment for the first five beats.
- If the public worker or RPC is unavailable, use `/evidence/captured-session.json`, the proof-anchor deployment metadata, and screenshots. Do not claim a live call succeeded if it did not.
- Keep the browser acceptance label visible as “unsigned preview” and the payment state as “No voucher.”
- Do not open an MPP session, sign a voucher, fund a wallet, settle, or deploy to Mainnet during the demo.
