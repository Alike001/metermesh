# MeterMesh judging map, pitch, and 90-second demo

This plan uses the seven dimensions published for X Layer AI Season: application of AI, innovation, product completeness, user value, integration with X Layer, growth potential, and contribution to the X Layer ecosystem. The terms also allow judges to consider onchain data, code quality, and market potential. Design and UX are not separately scored.

## Feature-to-criterion map

| Scored dimension               | MeterMesh evidence                                                                                                                                                                                                                                                          | Current strength                                                                                                | Remaining weakness                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Application of AI              | The worker gives Groq normalized X Layer receipt facts and accepts only a strict transaction-explanation schema. The model authors the summary, outcome, and limitations while deterministic code owns status, fees, addresses, logs, hashes, and authorization boundaries. | Strong and easy to prove from the signed evidence JSON.                                                         | The AI use case is intentionally narrow, one transaction explanation rather than several agent skills.                |
| Innovation                     | A buyer-signed XMTP request, seller-signed delivery, canonical result hash, browser verification, and X Layer evidence anchor create a portable proof for asynchronous AI work.                                                                                             | Stronger than a conventional chatbot or transaction dashboard because the result can be checked independently.  | The buyer decision remains an unsigned preview, so the full acceptance record is not yet portable.                    |
| Product completeness           | Public landing page, working verifier, bounded trial, PostgreSQL recovery, signed export, failure handling, documentation, Railway deployment, and a receipt-verified Mainnet proof anchor form one usable path.                                                            | Strong for the approved verification-first scope.                                                               | MPP settlement is deliberately unavailable.                                                                           |
| User value                     | Buyers can check that an AI result belongs to their request and to the exact X Layer transaction before trusting it.                                                                                                                                                        | Clear real problem for agent-to-agent work.                                                                     | Public demand is supported by ecosystem direction, but MeterMesh has no external user or integration metrics yet.     |
| X Layer integration            | Real chain 1952 receipt reads, explorer-linked success and revert evidence, a live Testnet commitment, and the same `MeterMeshProofAnchor` source deployed on X Layer Mainnet chain 196.                                                                                    | Strong, live, and independently verifiable.                                                                     | The Mainnet contract is an empty eligibility launch, and v1 performs no economic action.                              |
| Growth potential               | Versioned signed envelopes, machine manifest, OpenAPI read surfaces, `llms.txt`, portable proof export, and a pluggable MPP verifier let other agents integrate.                                                                                                            | Credible infrastructure path beyond this one interface.                                                         | The public trial is deliberately capacity-limited and there is no third-party adopter yet.                            |
| X Layer ecosystem contribution | MeterMesh supplies a reusable verification and evidence layer for agents using XMTP, X Layer receipts, and future OKX MPP settlement.                                                                                                                                       | Strong sponsor-gap story because X Layer agents need trustworthy work evidence between messages and settlement. | The MPP adapter cannot be demonstrated until OKX confirms chain 1952 session support.                                 |
| Onchain data                   | The UI and public JSON expose source transaction hashes, receipt status, block provenance, and the proof-anchor transaction.                                                                                                                                                | Strong and directly inspectable.                                                                                | The reverted RPC receipt has no verified revert reason, which MeterMesh correctly discloses.                          |
| Code quality                   | Protocol, MPP, AI, chain, database, worker, browser, and Foundry tests cover tampering, replay, wrong bindings, failure paths, and recovery.                                                                                                                                | Stronger than the partly mocked or untested prior winners found in research.                                    | A few live-network paths stay outside the normal deterministic test command and require the separate recorded checks. |
| Market potential               | MeterMesh can become the acceptance and evidence layer for paid agent work once settlement support is available.                                                                                                                                                            | The agent-commerce problem is growing and the proof format is portable.                                         | V1 proves work but does not yet prove revenue, settlement, or adoption.                                               |

## Honest positioning

MeterMesh is strongest on AI application, innovation, verifiability, code quality, real X Layer Testnet evidence, and a verified Mainnet contract launch. It remains weakest on visible economic action, adoption, and proven market traction. Keep the recording focused on the signed proof lifecycle because that is real, distinctive, and stronger than making an unsupported payment claim.

## Four-sentence pitch

AI agents can deliver work through messages, but buyers still have to trust that the answer matches their request and the claimed onchain evidence. MeterMesh is a verification and acceptance layer for AI work on X Layer. It binds a buyer-signed XMTP request to real X Layer receipt facts, a strict AI explanation, a seller-signed result hash, and a portable proof that the browser rechecks and can anchor onchain. As agents become economic participants, this proof layer lets users and future payment systems act on verified work instead of unverifiable messages.

## 90-second demo script

### 0:00-0:09, problem and product

Show the landing-page headline and the primary `Open live verifier` action.

Say: “AI agents can deliver useful work through messages, but a buyer still has to trust that the answer matches the request and the claimed chain evidence. MeterMesh makes that work independently verifiable.”

Judging signal: user value, innovation, product clarity.

### 0:09-0:22, one active proof

Open the workspace. Point to the signed request, X Layer Testnet transaction hash, and `Verified` state.

Say: “This is one real proof lifecycle. The buyer signed an XMTP request for this exact X Layer transaction, so the worker cannot silently substitute another transaction.”

Judging signal: X Layer integration, onchain data, product completeness.

### 0:22-0:39, bounded AI explanation

Move through the delivery and receipt facts. Point to the successful or reverted status, provenance, and limitations.

Say: “The worker reads the receipt from X Layer and normalizes status, fees, addresses, logs, and provenance. AI writes only the explanation fields under a strict schema. It cannot alter the receipt facts, approve payment, or hide a missing revert reason.”

Judging signal: application of AI, data quality, responsible AI, technical depth.

### 0:39-0:54, deterministic verification

Point to the buyer signature, seller signature, result binding, and proof checks. Open protocol details if needed.

Say: “The seller signs the canonical result hash. The browser then rechecks both signatures, the request-to-transaction binding, the delivery sequence, and the result hash. Any changed request, result, signer, or sequence fails closed.”

Judging signal: innovation, code quality, verifiability.

### 0:54-1:07, X Layer proof anchor

Open the anchored proof or its explorer link. Keep the contract address and anchor transaction visible.

Say: “The stable evidence hash is also committed by MeterMesh’s proof-anchor contract on X Layer Testnet. This explorer transaction proves the commitment exists independently of the frontend or database.”

Judging signal: X Layer integration, ecosystem contribution, onchain data.

### 1:07-1:19, real failure path

Show the published reverted proof and its `reverted` status, `failureReason: null`, and limitation.

Say: “The same path handled this real reverted X Layer transaction. MeterMesh reports the revert and gas facts, while clearly stating that the RPC did not provide a verified reason. It does not invent one.”

Judging signal: product completeness, application of AI, user trust.

### 1:19-1:30, ecosystem surface and honest boundary

Show the docs or manifest, then the compact MPP compatibility gate.

Say: “Builders and agents can discover the schemas, machine manifest, OpenAPI reads, and portable evidence. The MPP voucher verifier is ready, while Testnet settlement stays gated until OKX confirms chain 1952 support. MeterMesh proves AI work today and gives future settlement a trustworthy acceptance input.”

Judging signal: growth potential, ecosystem contribution, product honesty.

## Recording safety

- Use the published anchored proof as the primary path. It needs no wallet setup and is reverified in the browser.
- Use the published reverted proof to show real failure handling. Its missing revert reason is an honest limitation.
- Keep `No voucher`, `unsigned preview`, and the MPP gate visible whenever payment is discussed.
- Do not claim MPP session creation, settlement, revenue, or external adoption. The existing recording predates Mainnet. Any later Mainnet statement must claim only the receipt-verified empty proof-anchor deployment, not a Mainnet evidence write or payment.
- If Railway or venue internet fails, use the saved landing, workspace, and reverted-proof captures plus the checked-in evidence JSON.
