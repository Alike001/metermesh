# MeterMesh proof anchor

This source-only Foundry package defines the smallest X Layer primitive for MeterMesh: a one-time commitment of a stable signed-evidence hash and the X Layer transaction hash that the evidence explains.

The contract stores no funds, AI text, profiles, vouchers, or payment state. It is not deployed yet. Deployment and a live anchor transaction require separate approval because they spend gas and mutate a wallet.

Run the local tests with:

```sh
forge test --root contracts
```

The browser computes `anchorEvidenceHash` from the canonical signed request, signed delivery, and structured result. A future deployed contract can emit `EvidenceAnchored`, while the existing worker can index the event and attach the record to the exported proof.
