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
- [x] MeterMesh proof anchor deployed on X Layer Mainnet chain 196.
- [x] Mainnet contract: `0xb91256Fc57403cC096d969606459993fBd944384`
- [x] Mainnet deployment transaction: `0xb37205ae09c6719fa12797e472bbc50ac8145035006b7b3b1ab68a6d64e2a627`
- [x] Public claims state that MPP mutation, vouchers, settlement, and payment are gated.

## 2. Dedicated MeterMesh X account

- [x] Create a dedicated product account on X. Official account: https://x.com/MeterMesh
- [x] Use `MeterMesh` as the display name and `@MeterMesh` as the product handle.
- [ ] Add the MeterMesh mark as the profile image.
- [x] Set the website to `https://metermesh-web-production.up.railway.app`.
- [x] Use this bio: `Verifiable AI work over XMTP, grounded in X Layer receipts. Built for the X Layer AI Season.`
- [x] Publish one short introduction or build-progress post so the account is active: https://x.com/MeterMesh/status/2090855672304816370
- [x] Record the final handle: `@MeterMesh`.

## 3. Official submission post

The public introduction satisfies the account-activity requirement. The final narrated video post is the stronger submission evidence and should be used in the form: https://x.com/MeterMesh/status/2090928805145633215

After recording, this stronger video-post copy may replace it in the form:

Publish this from the dedicated MeterMesh account and keep `@XLayerOfficial` in the post:

> Meet MeterMesh: verifiable AI work over XMTP, grounded in X Layer. It binds a buyer-signed request, seller-signed AI result, and Testnet proof anchor into one portable receipt. Built for the @XLayerOfficial AI Season.
>
> https://metermesh-web-production.up.railway.app

- [x] Add the recorded demo video or a short product clip if X allows it.
- [x] Publish a related post from the dedicated MeterMesh account with `@XLayerOfficial`.
- [x] Verify the published post through X's public official embed endpoint.
- [x] Record the current post URL: `https://x.com/MeterMesh/status/2090928805145633215`.
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
- X post URL: `https://x.com/MeterMesh/status/2090928805145633215`

- [ ] Check every link in a private browser window before submitting.
- [x] Submit the form before the published deadline.
- [x] Save the supplied confirmation screen as submission evidence.
- [x] Record the submission confirmation locally in `handoff.md` and `log.md`.

## 5. X Layer Mainnet requirement, completed

The official requirements say the Testnet deployment must subsequently launch on X Layer Mainnet. The same tested, non-custodial `MeterMeshProofAnchor` source was deployed and independently verified on chain `196` after the submission was recorded.

- [x] Approve a separate Mainnet deployment plan before any wallet is funded or any transaction is broadcast.
- [x] Use a dedicated self-custodial Mainnet deployment wallet. Never reuse the Testnet-only merchant key.
- [x] Run a read-only preflight for chain 196, bytecode, deployer balance, gas estimate, and constructor arguments.
- [x] Fund only the approved gas amount after reviewing the estimate.
- [x] Deploy the same non-custodial `MeterMeshProofAnchor` source to X Layer Mainnet.
- [x] Verify the receipt, runtime bytecode, chain ID, and empty read-only contract state.
- [x] Add public Mainnet deployment metadata and link it from the repository and submission evidence.

Mainnet contract: https://web3.okx.com/explorer/x-layer/address/0xb91256Fc57403cC096d969606459993fBd944384

Deployment transaction: https://web3.okx.com/explorer/x-layer/tx/0xb37205ae09c6719fa12797e472bbc50ac8145035006b7b3b1ab68a6d64e2a627

## 6. Recording gate

- [ ] Public deployment contains the final truthful title and mobile fixes.
- [ ] Desktop and mobile Playwright checks pass against the public URL.
- [ ] Worker health is checked before relying on a live XMTP request.
- [ ] Captured proof, screenshots, and local fallback are available offline.
- [ ] The presenter has rehearsed `submission/demo-script.md` below 90 seconds.
- [x] The published recording makes no signed buyer acceptance, MPP session, voucher, settlement, payment, or Mainnet claim. The separately completed Mainnet deployment is documented through its later public receipt.
