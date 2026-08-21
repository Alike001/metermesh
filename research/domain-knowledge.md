# X Layer AI Season domain research

Research completed on 2026-08-19. Sources were checked live where possible. Official OKX and X Layer sources are treated as primary evidence. GitHub READMEs and project claims are identified as such, and community posts are treated as directional signals rather than proof of market demand.

## 0A. Current support and judging recheck, 2026-08-21

The official [AI Season page](https://web3.okx.com/xlayer/build-x-series) is still the source of truth for this submission. It lists seven judging dimensions: application of AI, innovation, product completeness, user value, integration with X Layer, growth potential, and contribution to the X Layer ecosystem. Its terms also say final rankings may consider onchain data, code quality, innovation, and market potential. Design and UX are not a named scored dimension.

The same page requires AI in the product, deployment on X Layer Testnet during the hackathon followed by Mainnet launch, a dedicated active X account, a submission post mentioning `@XLayerOfficial`, and Google Form submission by 2026-08-21 at 23:59 UTC. MeterMesh now has a MeterMesh-owned proof-anchor contract deployed on X Layer Testnet, with one fresh signed live proof anchored and read back successfully. The later Mainnet launch requirement remains outstanding.

The current official [OKX Payments MPP TypeScript guide](https://github.com/okx/payments/blob/master/typescript/bu-payments/app-mpp/README.md) shows the EVM session example with `chainId: 196`. The [seller guide](https://github.com/okx/payments/blob/master/typescript/SELLER.md) specifies `chainId: 196` for session method details, and the MPP EVM README describes support for X Layer chain `196`. The API lifecycle includes open, top-up, settle, close, status, and charge operations, but these sources do not list X Layer Testnet chain `1952`. The current official repository does include a separate x402 exact-payment demo for `eip155:1952`, with test USDt0 `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`, and the official Mock Merchant uses that path. This proves x402 Testnet support, not MPP session support.

MeterMesh's public issue [okx/payments#1](https://github.com/okx/payments/issues/1) still asks whether MPP session open, status, settle, and close accept chain `1952`, the published testnet escrow, and test USDt0. It remains open with zero maintainer comments. The official MPP HTTP reference still labels the session API as X Layer chain `196`, while the separate x402 docs explicitly show a `1952` Testnet flow. Until written confirmation or one approved MPP Testnet session proves the path, MeterMesh must describe MPP as planned and gated. No MPP payment mutation has been attempted.

## 1. Judging criteria and track rules

### Published judging criteria

The [official AI Season page](https://web3.okx.com/xlayer/build-x-series) says projects will be judged on:

1. Application of AI
2. Innovation
3. Product completeness
4. User value
5. Integration with X Layer
6. Growth potential
7. Contribution to the X Layer ecosystem

The terms add that final decisions may also consider onchain data, code quality, innovation, and market potential. For the AI-RWA Liquidity Grant, the stated factors are product quality, innovation, user value, overall performance, and contribution to the X Layer ecosystem.

Design and UX are not named as scored dimensions. Phase 3 should therefore aim for a clear, credible, finished interface without trading technical depth for decorative polish. Product completeness and user value still require the core flow to be easy to understand and use.

### Requirements and restrictions

| Area                    | Published requirement                                                                                            | Practical consequence                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Product                 | AI must be part of the product and the product must be deployed on X Layer                                       | AI cannot be a label added to a conventional DApp. The X Layer integration must be central and demonstrable. |
| Deployment              | Deploy on X Layer Testnet during the hackathon, then launch on X Layer Mainnet                                   | A local-only contract or a frontend with no X Layer deployment is ineligible.                                |
| Submission              | Submit the designated Google Form by 2026-08-21 at 23:59 UTC                                                     | The form, public links, deployment evidence, and project account need to be ready together.                  |
| Social account          | Maintain a dedicated X account and publish a submission post mentioning `@XLayerOfficial`                        | This is an eligibility requirement, not optional promotion.                                                  |
| Originality and conduct | No plagiarism, fraud, wash trading, volume manipulation, or other abuse                                          | Existing projects can inform patterns, but the submission needs original work created for this event.        |
| Eligibility             | Participants must be at least 18 or the age of majority in their jurisdiction and must not be restricted persons | The organizer may run eligibility, sanctions, and KYC checks before awarding prizes.                         |
| Prize wallet            | A self-custodial wallet must receive any prize                                                                   | The organizer will not custody participant keys or seed phrases.                                             |

### Prize mechanics that affect product strategy

- The main Hackathon Grant pays 30,000 USDT, 15,000 USDT, and 5,000 USDT to the top three projects.
- The 50,000 USDT Liquidity Grant is only for the best AI-RWA project and must support project growth and the X Layer ecosystem.
- The Launch Grant can reach 200,000 USDT. Each complete 10,000,000 USDT of eligible cumulative trading volume unlocks 50,000 USDT by 2026-08-31 at 23:59 UTC+8.
- Only trades executed through the OKX DEX interface count toward Launch Grant volume. Transactions made through the OKX DEX API do not count. This makes a purely API-driven trading agent a poor fit for that grant even if it is technically strong.
- Onchain activity will be reviewed for manipulation, and the official data snapshot is scheduled for 2026-09-01.

### Feature-to-criterion rule for later phases

Every v1 feature should support at least one published dimension. The strongest features will usually support several at once, such as a real X Layer transaction that proves AI utility, product completeness, ecosystem integration, and user value. A feature that only adds visual novelty ranks below one that improves a scored dimension.

## 2. Chain/protocol domain knowledge

### Current X Layer architecture

Current [X Layer developer documentation](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/about-xlayer) and the [official X Layer Toolkit](https://github.com/okx/xlayer-toolkit) describe X Layer as an EVM-equivalent Layer 2 based on an enhanced Optimism OP Stack. The mainnet chain ID is `196`, the testnet chain ID is `1952`, and OKB is the native gas token. The public mainnet RPC is `https://rpc.xlayer.tech`. The testnet documentation exposes `https://testrpc.xlayer.tech/terigon` among its public endpoints.

The network uses a trusted sequencer and an optimistic rollup model with a seven-day challenge period for final settlement to Ethereum. Current documentation describes one-second blocks, an OP Stack execution path, AggLayer integration, bridge services, and support for standard EVM tooling. The official toolkit provides local devnets and self-hosted RPC setups using Geth or Reth.

One important documentation conflict needs to remain visible. The older [okx/xlayer-docs repository](https://github.com/okx/xlayer-docs) still describes X Layer as Polygon CDK and zkEVM based, while current official web documentation and the actively maintained toolkit describe OP Stack. An [open documentation issue](https://github.com/okx/xlayer-docs/issues/140) also records an OP Stack genesis and node startup problem. Builders should use the current web documentation and toolkit as the source of truth, and should pin any chain assumptions in tests.

### Official builder tools that should be reused

- [X Layer Toolkit](https://github.com/okx/xlayer-toolkit): self-hosted mainnet and testnet RPC setup, local OP Stack devnet, Geth and Reth support, Docker deployment, fault-proof and operational tooling.
- [OKX DEX SDK](https://github.com/okx/okx-dex-sdk): TypeScript support for quotes, swaps, approvals, broadcasting, simulation, retries, and order tracking. X Layer mainnet chain `196` is explicitly supported.
- [OnchainOS Skills](https://github.com/okx/onchainos-skills): official agent skills for wallet actions, market data, token research, security checks, swaps, transaction simulation and broadcast, payments, DeFi, agent identity, and third-party DApp routing across X Layer and other chains.
- OnchainOS CLI and MCP: the official `onchainos` CLI also runs as an MCP server. This is the preferred agent integration layer when its supported operations fit the product.
- Standard EVM tools: current documentation includes viem chain definitions, contract deployment and verification guides, RPC, WebSocket, Flashblocks, Builder Codes, explorers, and faucet access.

The DEX SDK examples require an API key, secret, passphrase, project ID, and a wallet private key. Any product using it must keep credentials and signing material out of the browser. The OnchainOS repository includes shared sandbox credentials for local testing, but the repository warns that they are rate-limited and unsuitable for production. Production use requires separate credentials.

### Current product surfaces

#### OnchainOS and Agent Payments Protocol

OnchainOS is a broad agent-facing tool surface, not only a price API. Its maintained skills compose wallet actions, token and market research, security screening, transaction simulation, swaps, payments, DeFi positions, and audit logs. The official skill set also includes an X Layer agent marketplace based on ERC-8004 identity, XMTP communication, and an onchain task state machine with user, service-provider, and evaluator roles.

The [Agent Payments Protocol](https://web3.okx.com/id/learn/agent-payments-protocol) aims to cover quoting, negotiation, payment, settlement, usage metering, escrow, and disputes across HTTP and agent-to-agent channels. The current [Agent Seller quickstart](https://web3.okx.com/onchainos/dev-docs/payments/agent-seller) says one-time payment is available, while agent-side escrow and pay-as-you-go remain "coming soon." This is a verified gap in the public APP seller flow as of the research date.

Phase 2 verification narrowed this gap. The official [OKX Payments SDK](https://github.com/okx/payments) already implements MPP session actions for open, voucher, top-up, intermediate settlement, status, and close using onchain escrow and cumulative EIP-712 vouchers. The published seller implementations are HTTP 402 oriented, and the Rust SDK explicitly lists session SSE streaming as unsupported. Metered payment cryptography is therefore existing infrastructure. The remaining product opportunity is a durable asynchronous messaging adapter for agent sellers, including message correlation, replay protection, recovery, and delivery-gated voucher progression.

X Layer Testnet support was also checked directly. Chain `1952` has contract bytecode at the SDK's published escrow address `0x5E550002e64FaF79B41D89fE8439eEb1be66CE3b`, and official OnchainOS documentation publishes test USDt0 at `0x9e29b3aada05bf2d2c827af80bd28dc0b9b4fb0c`. The remaining implementation gate is confirming that the OKX Service Account session endpoints accept these testnet parameters.

The task marketplace and APP payment surface should not be treated as identical. The OKX AI task marketplace documentation includes a dispute lifecycle and evaluator flow. The APP seller documentation separately says its escrow and agent-side pay-as-you-go flows are not yet available. A future product must name the exact surface it uses.

#### Exchange OS

The June 2026 [Exchange OS whitepaper](https://web3.okx.com/whitepaper/okx-exchange-os.pdf) presents X Layer as permissionless exchange infrastructure. It describes deployers, issuers, interfaces, supporters, and market makers sharing components for spot markets, perpetuals, outcome markets, balances, margin, matching, liquidation, and settlement. AI agent platforms are explicitly listed as a possible interface type.

The whitepaper says detailed contract interfaces and schemas, risk parameters, slot auction mechanics, liquidation logic, and reference implementations sit outside the whitepaper and belong in a separate protocol specification. The launch material also describes a staged rollout. The verified opportunity is a public builder-experience gap: the vision is clear, but the stable, publicly documented integration surface is less complete than the product vision. That does not prove the underlying protocol cannot support a capability. It means a hackathon build must verify available contracts and interfaces before depending on them.

### Sponsor and protocol gaps worth carrying into ideation

These are evidence-backed gaps, not Phase 2 ideas:

1. Current and old X Layer documentation disagree about the underlying stack. A builder can easily follow stale Polygon CDK guidance instead of current OP Stack guidance.
2. APP seller-side escrow and pay-as-you-go over agent messaging are documented as coming soon. The underlying OKX Payments SDK already supports HTTP-oriented MPP sessions, so the gap is the agent-seller messaging integration and its asynchronous state handling.
3. Exchange OS exposes a large permissionless exchange vision, but its detailed builder contract specification and reference implementations were not found in the public whitepaper or current public documentation scan.
4. Launch Grant volume is tied to the OKX DEX interface and explicitly excludes DEX API trades. Agent automation and grant-qualified interface volume are different product paths.
5. OnchainOS has strong breadth, but production credentials, secure signing, policy boundaries, idempotency, recovery, and clear evidence remain the application builder's responsibility.
6. Official agent tools cover discovery and execution across many chains. X Layer-specific differentiation must therefore come from the product's onchain mechanism or its use of X Layer-native commerce and exchange primitives, not from calling a generic multi-chain endpoint.

### Technical constraints to preserve

- X Layer deployment and explorer-verifiable activity are mandatory.
- AI output must never be the only authority for a financial action. User intent, transaction parameters, limits, and contract state need deterministic validation.
- Frontends must not contain private keys or OKX secrets.
- Public RPC, indexing, and API dependencies need cached or local fallback data for demo day.
- The chain is the source of truth for ownership, settlement, balances, and contract state. Profiles, search indexes, notifications, analytics, and cached reads belong offchain unless trustlessness is central to the use case.

## 3. What's trending, and where real problems surface

### Strong current narratives

1. Agent commerce is moving from chat and recommendations toward agents that can identify themselves, negotiate, pay, deliver work, and leave evidence. OKX is actively building this through APP, OnchainOS, its X Layer agent task marketplace, x402-related flows, and ERC-8004 identity.
2. Permission and accountability are becoming more important than raw agent autonomy. Products such as [Elytro Agent Wallet](https://www.producthunt.com/products/elytro-agent-wallet) emphasize self-custody and onchain spending rules. Product Hunt discussions around agent wallets and payment tools repeatedly focus on who controls keys, what an agent may spend, and how its actions can be audited.
3. X Layer is positioning itself as exchange infrastructure through Exchange OS. The opportunity extends beyond another swap screen to issuance, market deployment, interface tooling, shared liquidity, agent interfaces, and operational tooling.
4. Real execution evidence matters because AI and DeFi projects often stop at API composition. A recent empirical [study of DeFi investment agents](https://arxiv.org/abs/2605.29174) found that many visible deployments offered limited evidence of autonomous execution and often remained basic integrations. This supports the hackathon's emphasis on product completeness, code quality, and onchain data.
5. Stablecoin-based machine payments, x402-style access, service discovery, and verifiable identity are receiving active ecosystem investment. The important missing layer is often safe authorization, receipts, dispute paths, and reliable state handling rather than the payment transaction alone.

### Who is actively building or funding

- X Layer and OKX are funding AI plus Web3 applications through the current prize pool, the AI-RWA Liquidity Grant, and the Launch Grant.
- OKX is actively maintaining OnchainOS skills, its MCP and CLI surface, Agent Payments Protocol, the X Layer toolkit, the DEX SDK, OKX.AI agent identity and task flows, and Exchange OS.
- The APP launch materials place OKX in a broader agent-commerce ecosystem that includes infrastructure, wallet, chain, data, and cloud partners. Partner presence is evidence of active ecosystem formation, but not proof that every integration is production-ready.
- AI-RWA has a dedicated grant, but the project's feasibility filter rules out real-world custody, regulated claims, insurance, and legal frameworks that cannot be completed within the build. Any RWA direction would need a usable, permissionless data or settlement mechanism without pretending legal enforceability exists.

### Direct problem signals from communities

Community posts are small and noisy samples, so they support problem discovery rather than validate a market by themselves.

- A July 2026 [r/hackathon discussion](https://www.reddit.com/r/hackathon/comments/1uhuxbw/looking_for_realworld_problem_statements_for_an/) described small businesses manually matching payments, invoices, partial refunds, and messages across several systems. The hard part was matching records, getting approvals, and preserving an audit trail. This maps well to agent payment receipts and exception handling, but a target user still needs direct validation.
- A current [r/web3dev discussion](https://www.reddit.com/r/web3dev/comments/1vrhysb/too_many_web3_projects_are_solving_blockchain/) argues that many Web3 projects foreground the chain instead of the user outcome. This is a useful product warning: the user should feel cheaper settlement, safer delegation, or a new capability, not just see technical components.
- A [fintech discussion about reconciliation](https://www.reddit.com/r/fintech/comments/1pzbz15/ai_for_financial_reconciliation_what_problems_are/) highlights exception handling around partial payments, timing differences, and inconsistent transaction descriptions. This suggests that clean happy-path payment demos miss the real operational pain.
- Hackathon discussions increasingly dismiss generic AI-generated interfaces and API chaining without a defensible mechanism. This aligns with the project's technical-depth rule.

### X, Product Hunt, and Google Trends checks

- Searches for attributable X posts from X Layer engineers and developer advocates did not surface a reliable, direct "build this" request. No sponsor hint should be invented from weak search results. Official docs and maintained repositories are stronger evidence.
- Product Hunt activity around Elytro, Prava, DCP, Walle, and agent cards shows crowded interest in agent wallets, scoped spending, payments, and secret handling. A generic agent wallet would enter an active category with several existing products. A narrower X Layer-native control, commerce, or builder layer has a clearer differentiation path.
- Google Trends did not provide a stable, machine-readable comparison that could support a numeric trend claim in this research environment. General search evidence shows agentic commerce and agent payments receiving attention, but the document does not claim a Google Trends growth percentage.

### Real data for a credible product

- X Layer contract events, transaction receipts, OKLink explorer data, and official OnchainOS market and wallet APIs are the strongest native data sources.
- [FRED](https://fred.stlouisfed.org/docs/api/fred/) offers real economic time series if a later direction needs macro or public-market context.
- A data.gov and municipal open-data search did not surface an X Layer-specific dataset. Public civic data could support a later real-world use case, but it would need a clearly justified link to X Layer rather than being included for appearance.
- Kaggle results found during this scan included synthetic scam data and cross-chain research datasets with unclear X Layer relevance. They should not be presented as real X Layer evidence.
- Seeded data for offline demonstrations should be captured from real testnet or mainnet activity and labeled with its source and capture time. It should never be fabricated to imply an action occurred.

### Research synthesis

The strongest combined narrative is trusted agent execution on X Layer: agents can now discover tools, hold identities, communicate, and make payments, while users and builders still need clearer boundaries, evidence, recovery, and complete commerce flows. Exchange OS adds a second narrative around permissionless market infrastructure, but its public builder surface needs further verification before it can anchor a build. Both narratives are more chain-relevant than a generic AI trading dashboard.

## 4. Past winners (this hackathon or similar ones on this chain)

Public winner reporting is incomplete. The strongest official source found is the [Build XAgent results page](https://xagt.ai/hackathon), a prior OKX OnchainOS event powered by X Layer. ShieldSuite's placement is a repository claim and is labeled separately.

### Winner review

| Project                                                                    | Result and source strength                                                                                                             | What it built                                                                                                                              | Why it likely won                                                                                                                                                        | What it got wrong or could improve                                                                                                                                                                                                    |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [WhaleSensei](https://github.com/Enoch208/WhaleSensei)                     | Official Build XAgent Builder 1st. The results page links this repository, but it was unavailable during the scan.                     | A Telegram group where each member has an AI agent. The agents combine five OKX skills to detect and discuss whale activity together.      | It turned multiple OKX capabilities into one social behavior that a user can understand quickly. The product story is more memorable than a standalone signal dashboard. | The unavailable repository prevents independent verification of implementation depth, tests, and deployment. Any comparison must stay limited to the public description.                                                              |
| [Agent Alpha Terminal](https://github.com/songnestle/agent-alpha-terminal) | Official Build XAgent Builder 2nd. Repository cloned and read.                                                                         | A broad agent cockpit for research, portfolio reasoning, swaps, safety checks, and market workflows.                                       | It gave judges a coherent control-room story and showed how several OKX capabilities could work together.                                                                | The README openly labels core data and wallet execution as mocked and describes real OKX adapters as future work. The scan found no test or contract files. A new submission should beat it on real execution and proof, not breadth. |
| [MonadHarvest](https://github.com/big-dudu-mosty/MonadHarvest)             | Official Build XAgent no-code 1st. Repository cloned and read.                                                                         | An onchain farming game with NFT seeds, land, social gifting, a token economy, wallet play, and OKX-powered asset, swap, and market views. | It wrapped Web3 actions in a clear consumer loop and gave the chain activity an approachable reason to exist.                                                            | The game runs on Monad testnet while OKX data calls target Ethereum. The production signing proxy is not included, and generated dependencies inflate the repository. OKX and X Layer are peripheral rather than the product's core.  |
| [ShieldSuite](https://github.com/mrnetwork0001/ShieldSuite)                | Repository claims 3rd place in X Layer Build X Season 2. No independent official placement page was found. Repository cloned and read. | A security-gated DEX combined with no-loss sports speculation, ScanGuard MCP, x402, and OnchainOS integration.                             | If the placement claim is accurate, it likely scored through visible X Layer deployment, security utility, and several sponsor-native integrations.                      | The product combines two large concepts and risks an overstuffed story. Its result should not be treated as officially verified, and its sports-market surface is too close to reuse without a substantial reinterpretation.          |

The wider 2025 X Layer ETHCC winner list, reported by [Odaily](https://www.odaily.news/en/post/5206007), included a central-limit-order-book DEX, agent payments in Notion, account-abstraction wallets, cross-chain DeFi, and escrow. Public code links were not consistently available, so these projects were used as category evidence rather than code benchmarks.

### What judges appear to reward

- A user story that can be repeated in one sentence
- Several sponsor capabilities composed into one coherent job
- Visible onchain action or a product loop, even when implementation quality varies
- Practical utility around execution, payments, safety, or asset use
- A surface that feels usable by a person rather than a raw protocol example

The bar left open by these winners is production truth. Some winning projects were broad, partly mocked, peripheral to X Layer, or difficult to verify. A narrower product with real X Layer deployment, explorer evidence, tested failure handling, and one indispensable chain-specific mechanism can present a stronger case than a larger feature set.

### Infrastructure versus consumer split

The four inspectable examples lean toward consumer products and agent terminals. The broader ETHCC list included stronger infrastructure elements such as a CLOB, account abstraction, payment rails, and escrow, but those were generally presented through user-facing products. A pure developer tool did not dominate this sample. That leaves a credible opening because the current judging criteria explicitly reward code quality, ecosystem contribution, X Layer integration, and growth potential.

## 5. Reference builders - deep scan for alignment with THIS protocol

The named profiles were scanned for exact X Layer work first, then for mechanics that could transfer to X Layer. Close projects are marked as originality risks. No project should be forked or lightly reskinned for submission.

### winsznx

- [The Eleven](https://github.com/winsznx/theeleven) and its related Regista11 work build AI football market agents around a custom Uniswap v4 hook on X Layer chain `196`. The system includes gasless EIP-3009 USDT0 flows, an MCP or skill surface, deterministic tick processing, refund and reveal handling, contracts, and layered tests.
- Adaptable mechanics: deterministic onchain action loops, signed gasless payments, state restoration for pending actions, user refund paths, live deployment evidence, and a protocol-native hook that makes the chain essential.
- Missing or improvable: the resolution and oracle trust path remains a hard product boundary, and the total system is complex. Any sports, outcome-market, v4-hook, or autonomous market direction would be too close and needs a substantial reinterpretation.
- [UNTCH](https://github.com/winsznx/untch) is a policy and authority layer for agents. It combines OKX.AI service identity, x402 paid services on X Layer, receipt anchoring, deterministic rules, delivery verification, and double-entry accounting. Its own documentation is unusually candid about unfinished exact approvals, escalation wiring, and mainnet receipt work.
- Adaptable mechanics: explicit policy evaluation, durable receipts, payment reconciliation, deterministic delivery checks, and honest capability status.
- Missing or improvable: the repository notes testnet facilitator and production-path gaps. A new policy, payment-control, receipt, or agent-governance product would overlap heavily and must solve a different user problem with a distinct mechanism.

### Timidan

- No exact X Layer project was found in the latest public repositories checked.
- [Proof of Regret](https://github.com/Timidan/proof-of-regret) runs on Base Sepolia and uses deterministic policy to select bounded proposals, simulate them, commit and settle a choice, and preserve rejected options as counterfactual learning evidence.
- Adaptable mechanics: simulation before execution, small onchain commitments, idempotent settlement, and keeping rejected actions as useful evidence instead of discarding them.
- Missing for X Layer: no OnchainOS, OKX identity, APP, DEX, or Exchange OS adapter. Porting the same product would remain generic. Any use of the pattern needs an X Layer-native user problem and state transition.

### Blockchain-Oracle

- No exact X Layer project was found in the latest public repositories checked.
- [mPilot](https://github.com/Blockchain-Oracle/mpilot) is a Mantle DeFi agent using a Plan, Simulate, Propose, Execute, Record lifecycle, ERC-4337 session keys, ERC-8004 reputation, MCP, npm, skill, and web surfaces. The repository has a multi-package architecture and live-network evidence.
- Adaptable mechanics: a single typed core exposed through several agent surfaces, simulation-first execution, provider adapters, session-scoped authority, and durable action records.
- Missing for X Layer: X Layer transaction, indexer, OnchainOS, APP, Exchange OS, and OKX-specific adapters. A generic DeFi agent on X Layer would be too shallow, so the mechanism must solve an X Layer-specific gap.

### mrnetwork0001

- [HatchAI](https://github.com/mrnetwork0001/HatchAI) is deployed on X Layer mainnet and testnet. It uses a Uniswap v4 hook for token launches with dynamic fee decay, anti-whale caps, cooldowns, and buyback and burn behavior.
- Adaptable mechanics: hook-enforced market rules, deterministic constraints around asset launches, public deployment evidence, and a product whose core action happens in a contract rather than in a UI wrapper.
- Missing or improvable: the AI role appears less central than the hook mechanics, and claims of zero offchain dependency need care when agent integrations exist. A launchpad or v4-hook product would be too close for this event.
- [ShieldSuite](https://github.com/mrnetwork0001/ShieldSuite) combines X Layer, OnchainOS, MCP, x402, security scanning, a gated DEX, and sports speculation. It is strongly aligned with the current event but broad in scope.
- Originality warning: sports markets, no-loss prediction mechanics, security-gated swaps, and the same sponsor integration bundle require substantial reinterpretation, not incremental additions.

### Enoch208

- The Build XAgent page identifies WhaleSensei as the Builder winner and links `Enoch208/WhaleSensei`, but the repository was unavailable during the research scan. No other exact X Layer project was found in the latest public repositories checked.
- Other public work from this builder touches agent controls, observability, identity, and micropayments on other ecosystems.
- Adaptable mechanics: social multi-agent coordination, shared evidence, agent reputation, and a group-level interface instead of a solitary chatbot.
- Missing for verification: source code, tests, deployments, and the exact five-skill composition could not be independently inspected. The public winner description should inform category comparison but not architectural decisions.

### Cross-builder patterns worth carrying forward

1. The best repositories separate planning or AI reasoning from transaction authorization and execution.
2. Simulation, deterministic limits, idempotency, recovery, and receipts turn an agent demo into a defensible financial product.
3. One typed core can support a web app, CLI, MCP server, and agent skill without duplicating business logic.
4. Live contract addresses, explorer links, status pages, and candid limitation lists are stronger evidence than architecture diagrams alone.
5. Protocol-native mechanisms such as hooks, signed payments, event state machines, session keys, and onchain receipts create technical depth. Calling a market API and displaying its response does not.
6. Several close reference projects already cover policy engines, agent terminals, v4 hooks, sports markets, launchpads, and broad DeFi agents. Phase 2 needs different product genres or a clearly different core mechanism.

## 6. Existing production tools in this ecosystem

Three official, open-source OKX repositories were shallow-cloned to an isolated temporary directory and inspected at the README, package, module, example, test, and configuration levels. No source was copied into this project.

### X Layer Toolkit

Repository: [okx/xlayer-toolkit](https://github.com/okx/xlayer-toolkit)

What it provides:

- One-command self-hosted X Layer RPC setup
- Mainnet and testnet support
- Local OP Stack devnet
- Geth and Reth execution clients
- Docker configuration, logs, initialization, and synchronization
- Fault-proof, conductor, upgrade, trace-monitoring, and benchmarking utilities

Professional patterns to match:

- Operational tasks are split into narrow modules rather than one opaque script.
- Setup is reproducible and containerized.
- Health, logs, client choice, and network selection are explicit.
- Documentation starts with runnable commands and expected operating modes.

### OKX DEX SDK

Repository: [okx/okx-dex-sdk](https://github.com/okx/okx-dex-sdk)

What it provides:

- A TypeScript SDK for quotes, approvals, swaps, signing, broadcast, simulation, and order tracking
- Typed adapters across EVM, Solana, Sui, TON, and TRON
- X Layer chain `196` support
- Examples, retry behavior, error handling, and tests

Professional patterns to match:

- Network differences sit behind adapters while common business flow stays shared.
- Error classes, retry rules, transaction status, and simulation are first-class.
- Examples show complete operations rather than isolated HTTP calls.
- Credentials and signing configuration are explicit, although a production product should improve the security boundary by keeping them server-side or in a secure wallet runtime.

### OnchainOS Skills and CLI

Repository: [okx/onchainos-skills](https://github.com/okx/onchainos-skills)

What it provides:

- An actively maintained Rust CLI that also exposes an MCP server
- Skills for wallet, DEX, market, token, security, payments, DeFi, agent identity, task markets, audit logs, and DApp discovery
- Multi-step workflows that compose lower-level capabilities
- Extensive routing instructions, references, examples, and tests
- Support for X Layer and more than 20 other chains

Professional patterns to match:

- Intent routing is separated from operation-specific references.
- The CLI is the common execution layer for skills and MCP, reducing duplicated integration logic.
- Financial operations are staged through quote, simulation, signing, broadcast, tracking, and audit.
- The repository documents unsafe assumptions, including shared sandbox credentials and production credential requirements.
- Workflow composition is explicit and inspectable instead of being hidden inside an LLM prompt.

### Production benchmark for this project

A credible submission should borrow the engineering standard, not the product concepts:

- one short setup path
- explicit environment and secret handling
- typed boundaries around chain and API calls
- deterministic validation before signing
- simulation, retries, idempotency, and transaction tracking
- event-driven indexing instead of live chain scans on every page load
- real tests for bad input and failure recovery
- local or cached fallback data from real activity
- public deployment evidence and a candid list of limitations
- one core implementation shared by any web, CLI, MCP, or skill surfaces

This is the practical bar for a product that can be understood and run in 30 seconds while still surviving judge questions about what is real.
