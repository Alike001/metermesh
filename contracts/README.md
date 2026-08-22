# MeterMesh proof anchor

This source-only Foundry package defines the smallest X Layer primitive for MeterMesh: a one-time commitment of a stable signed-evidence hash and the X Layer transaction hash that the evidence explains.

The contract stores no funds, AI text, profiles, vouchers, or payment state. It is deployed on X Layer Testnet at `0xE9827c90f742C593F966B7E878e2a13fdC8f1683` and X Layer Mainnet at `0xb91256Fc57403cC096d969606459993fBd944384`. Both deployment receipts and runtime bytecode checks passed. One approved live evidence anchor transaction succeeded on Testnet. The Mainnet contract remains empty and records no evidence or payment state.

Run the local tests with:

```sh
forge test --root contracts
```

The browser computes `anchorEvidenceHash` from the canonical signed request, signed delivery, and structured result. One fresh signed XMTP proof is anchored on Testnet. The anchor transaction and readback metadata are recorded in `contracts/deployments/xlayer-testnet.json`.

Deployment metadata is recorded in `contracts/deployments/xlayer-testnet.json` and `contracts/deployments/xlayer-mainnet.json`.
