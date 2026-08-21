# MeterMesh AI Season eligibility checklist

Official rules: https://web3.okx.com/xlayer/build-x-series

Official submission form: https://docs.google.com/forms/d/e/1FAIpQLSfgU_3zcXdxK0GJQxj33QeUWdEcAaYnieVe9p5cFDb2JFQa4Q/viewform?usp=publish-editor

Published deadline: August 21, 2026, at 23:59 UTC.

## 1. Product evidence already complete

- [x] AI is part of the product through a schema-constrained X Layer transaction explanation.
- [x] Public product: https://metermesh-web-production.up.railway.app
- [x] Public documentation: https://metermesh-web-production.up.railway.app/docs/
- [x] Public source: https://github.com/Alike001/metermesh
- [x] MeterMesh proof anchor deployed on X Layer Testnet chain 1952.
- [x] Testnet contract: `0xE9827c90f742C593F966B7E878e2a13fdC8f1683`
- [x] Testnet deployment transaction: `0xf19caa7335ae10929aadc444ba149b803e64db428ac16dc2730df3dd0f241b65`
- [x] Testnet evidence-anchor transaction: `0xf518187f13559ab46cfa1c85d64089a8c99eca8d1ee9d77a41840046f0e7aa5a`
- [x] Public claims state that MPP mutation, vouchers, settlement, and payment are gated.

## 2. Dedicated MeterMesh X account

- [x] Create a dedicated product account on X. Official account: https://x.com/MeterMesh
- [x] Use `MeterMesh` as the display name and `@MeterMesh` as the product handle.
- [ ] Add the MeterMesh mark as the profile image.
- [x] Set the website to `https://metermesh-web-production.up.railway.app`.
- [x] Use this bio: `Verifiable AI work over XMTP, grounded in X Layer receipts. Built for the X Layer AI Season.`
- [ ] Publish one short introduction or build-progress post so the account is active.
- [x] Record the final handle: `@MeterMesh`.

## 3. Official submission post, user action required

Publish this from the dedicated MeterMesh account and keep `@XLayerOfficial` in the post:

> Meet MeterMesh: verifiable AI work over XMTP, grounded in X Layer. It binds a buyer-signed request, seller-signed AI result, and Testnet proof anchor into one portable receipt. Built for the @XLayerOfficial AI Season.
>
> https://metermesh-web-production.up.railway.app

- [ ] Add the recorded demo video or a short product clip if X allows it.
- [ ] Publish the post from the dedicated MeterMesh account.
- [ ] Open the published post in a private browser window to prove it is public.
- [ ] Record the post URL here: `[METER_MESH_X_POST_URL]`.
- [ ] Save a screenshot of the post as submission backup evidence.

## 4. Google Form values

- Project Name: `MeterMesh`
- Project Description:

  `MeterMesh is a verifiable AI-work layer for X Layer. A buyer signs a transaction-explanation request over XMTP, and the worker reads the real X Layer receipt before producing a schema-constrained AI explanation. The seller signs the canonical result hash, the browser verifies every binding, and a MeterMesh contract anchors the evidence hash on X Layer Testnet. The current product creates no voucher or payment because OKX MPP session mutation for Testnet chain 1952 is still unconfirmed.`

- Project URL: `https://metermesh-web-production.up.railway.app`
- Github: `https://github.com/Alike001/metermesh`
- Email: `[YOUR_ACTIVE_EMAIL]`
- Telegram: `[YOUR_TELEGRAM_HANDLE]`
- X handle: `@MeterMesh`
- X post URL: `[METER_MESH_X_POST_URL]`

- [ ] Check every link in a private browser window before submitting.
- [ ] Submit the form before the published deadline.
- [ ] Save the confirmation screen as a screenshot.
- [ ] Record the submission time and confirmation evidence locally.

## 5. X Layer Mainnet requirement, separate approval required

The official requirements say the Testnet deployment must subsequently launch on X Layer Mainnet. MeterMesh has no Mainnet deployment yet.

- [ ] Approve a separate Mainnet deployment plan before any wallet is funded or any transaction is broadcast.
- [ ] Use a dedicated self-custodial Mainnet deployment wallet. Never reuse the Testnet-only merchant key.
- [ ] Run a read-only preflight for chain 196, bytecode, deployer balance, gas estimate, and constructor arguments.
- [ ] Fund only the approved gas amount after reviewing the estimate.
- [ ] Deploy the same non-custodial `MeterMeshProofAnchor` source to X Layer Mainnet.
- [ ] Verify the receipt, bytecode, chain ID, and read-only contract state.
- [ ] Add public Mainnet deployment metadata and link it from the repository and submission evidence.

## 6. Recording gate

- [ ] Public deployment contains the final truthful title and mobile fixes.
- [ ] Desktop and mobile Playwright checks pass against the public URL.
- [ ] Worker health is checked before relying on a live XMTP request.
- [ ] Captured proof, screenshots, and local fallback are available offline.
- [ ] The presenter has rehearsed `submission/demo-script.md` below 90 seconds.
- [ ] No part of the recording claims a signed buyer acceptance, MPP session, voucher, settlement, payment, or Mainnet deployment unless that specific capability is completed and independently verified first.
