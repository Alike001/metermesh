# MeterMesh proof anchor

This source-only Foundry package defines the smallest X Layer primitive for MeterMesh: a one-time commitment of a stable signed-evidence hash and the X Layer transaction hash that the evidence explains.

The contract stores no funds, AI text, profiles, vouchers, or payment state. It is deployed on X Layer Testnet at `0xE9827c90f742C593F966B7E878e2a13fdC8f1683`. Deployment receipt and read-only bytecode verification passed. A live evidence anchor transaction remains separately gated because it spends gas and mutates the deployer wallet.

Run the local tests with:

```sh
forge test --root contracts
```

The browser computes `anchorEvidenceHash` from the canonical signed request, signed delivery, and structured result. The deployed contract can emit `EvidenceAnchored`, while the existing worker can index the event and attach the record to the exported proof after an approved live anchor write.

Deployment metadata is recorded in `contracts/deployments/xlayer-testnet.json`.
