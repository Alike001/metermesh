import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Copy, FileJson2, ShieldCheck } from "lucide-react";

import {
  COPYABLE_REQUEST_EXAMPLE,
  DOCUMENTATION_ARTIFACTS,
  loadDocumentationArtifacts,
  type CapabilityStatus,
} from "../domain/documentation";
import { BrandMark } from "./BrandMark";

const requestExample = JSON.stringify(COPYABLE_REQUEST_EXAMPLE, null, 2);

const navigation = [
  ["01", "Start here", "start"],
  ["02", "Lifecycle", "lifecycle"],
  ["03", "Schemas", "schemas"],
  ["04", "Trust boundary", "trust"],
  ["05", "Machine access", "machine"],
] as const;

const lifecycle = [
  ["01", "Request", "Buyer sends a signed transaction-hash request over XMTP."],
  ["02", "Deliver", "The agent returns a schema-valid explanation bound to chain evidence."],
  [
    "03",
    "Preview",
    "The current interface tests accept or reject locally without authorizing funds.",
  ],
  [
    "04",
    "Voucher · gated",
    "The protocol rule is tested, but no public buyer voucher path is enabled.",
  ],
  [
    "05",
    "Settle · gated",
    "OKX MPP settlement waits for confirmed chain 1952 Service Account support.",
  ],
] as const;

const schemaRows = [
  ["transactionHash", "bytes32 hex", "Required", "Public X Layer Testnet transaction"],
  ["workUnitId", "bounded string", "Required", "Unique ID for this requested result"],
  ["sequence", "positive integer", "Required", "Monotonic per sender inbox"],
  ["summary", "string", "Returned", "AI-authored, schema constrained"],
  ["provenance", "object", "Returned", "Deterministic RPC facts and capture time"],
] as const;

const fallbackStatuses: CapabilityStatus[] = [
  {
    id: "artifacts-loading",
    label: "Machine artifacts",
    note: "Checking the published manifest and OpenAPI document.",
    state: "gated",
  },
];

function CopyExampleButton() {
  const [copied, setCopied] = useState(false);

  async function copyExample() {
    await navigator.clipboard.writeText(requestExample);
    setCopied(true);
    window.setTimeout(() => {
      setCopied(false);
    }, 1600);
  }

  return (
    <button
      className="docs-copy-button"
      onClick={() => {
        void copyExample();
      }}
      type="button"
    >
      {copied ? <Check aria-hidden="true" size={14} /> : <Copy aria-hidden="true" size={14} />}
      {copied ? "Copied" : "Copy request"}
    </button>
  );
}

function StatusRail({ statuses }: { statuses: CapabilityStatus[] }) {
  return (
    <aside className="docs-truth-rail" aria-labelledby="truth-title">
      <div className="truth-heading">
        <ShieldCheck aria-hidden="true" size={17} />
        <h2 id="truth-title">Current truth</h2>
      </div>
      <div className="truth-list">
        {statuses.map((status) => (
          <article key={status.id}>
            <div>
              <span className={`status-dot status-dot-${status.state}`} aria-hidden="true" />
              <strong>{status.label}</strong>
            </div>
            <span className={`truth-state truth-state-${status.state}`}>{status.state}</span>
            <p>{status.note}</p>
          </article>
        ))}
      </div>
      <p className="truth-rule">
        Documentation availability is not runtime health. Verify signatures and chain receipts.
      </p>
    </aside>
  );
}

export function DocumentationPage() {
  const [statuses, setStatuses] = useState(fallbackStatuses);
  const [artifactError, setArtifactError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    loadDocumentationArtifacts((input, init) =>
      fetch(input, { ...init, signal: controller.signal }),
    )
      .then((manifest) => {
        setStatuses(manifest.capabilityStatus);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setStatuses([]);
        setArtifactError(
          error instanceof Error ? error.message : "Machine discovery is unavailable.",
        );
      });
    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="docs-page">
      <header className="docs-header">
        <a className="brand-link" href="/" aria-label="MeterMesh product home">
          <BrandMark />
        </a>
        <span className="docs-header-title">Integration reference / v0.1</span>
        <nav aria-label="Documentation links">
          <a href="/">Product</a>
          <a href="https://github.com/Alike001/metermesh" rel="noreferrer" target="_blank">
            Source <ArrowUpRight aria-hidden="true" size={14} />
          </a>
        </nav>
      </header>

      <div className="docs-shell">
        <aside className="docs-chapter-rail" aria-label="On this page">
          <p>On this page</p>
          <nav>
            {navigation.map(([number, label, id]) => (
              <a href={`#${id}`} key={id}>
                <span>{number}</span>
                {label}
              </a>
            ))}
          </nav>
          <a className="docs-back-link" href="/">
            <ArrowLeft aria-hidden="true" size={14} />
            Back to product
          </a>
        </aside>

        <main className="docs-content">
          <section className="docs-intro" id="start">
            <h1>One accepted result advances the meter.</h1>
            <p>
              MeterMesh currently proves a signed AI transaction explanation from a buyer wallet
              through XMTP, PostgreSQL, and an X Layer receipt. The buyer-controlled OKX payment
              session is the gated next path, and the public verifier cannot authorize funds.
            </p>
            <dl className="docs-facts">
              <div>
                <dt>Input</dt>
                <dd>X Layer transaction hash</dd>
              </div>
              <div>
                <dt>Output</dt>
                <dd>Evidence-bound explanation</dd>
              </div>
              <div>
                <dt>Billing rule</dt>
                <dd>Protocol tested, voucher unavailable</dd>
              </div>
              <div>
                <dt>Settlement</dt>
                <dd>Gated on chain 1952 support</dd>
              </div>
            </dl>

            <div className="docs-code-block" aria-label="Copyable MeterMesh request example">
              <div className="docs-code-header">
                <span>work.request / MeterMesh v1</span>
                <CopyExampleButton />
              </div>
              <pre>
                <code>{requestExample}</code>
              </pre>
            </div>
            <p className="docs-example-note">
              This copyable example passes the same envelope validator as the product.
            </p>
          </section>

          <section className="docs-section" id="lifecycle" aria-labelledby="lifecycle-title">
            <div className="docs-section-heading">
              <span>02</span>
              <div>
                <h2 id="lifecycle-title">Lifecycle</h2>
                <p>The work path is live. The value path remains visibly gated.</p>
              </div>
            </div>
            <ol className="docs-lifecycle">
              {lifecycle.map(([number, title, detail]) => (
                <li key={title}>
                  <span>{number}</span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                </li>
              ))}
            </ol>
            <div className="docs-rule-band">
              <strong>Deterministic billing boundary</strong>
              <p>
                Payload hashes, signatures, sequences, references, and voucher arithmetic are
                re-runnable checks. AI writes summary, outcome, and limitations. AI never signs a
                buyer voucher.
              </p>
            </div>
          </section>

          <section className="docs-section" id="schemas" aria-labelledby="schemas-title">
            <div className="docs-section-heading">
              <span>03</span>
              <div>
                <h2 id="schemas-title">Schema at a glance</h2>
                <p>Stable fields for one complete transaction-explanation path.</p>
              </div>
            </div>
            <div className="docs-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Shape</th>
                    <th>Direction</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {schemaRows.map((row) => (
                    <tr key={row[0]}>
                      <th scope="row">{row[0]}</th>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>{row[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="docs-schema-links">
              <a
                href="https://github.com/Alike001/metermesh/blob/main/packages/protocol/src/schema.ts"
                rel="noreferrer"
                target="_blank"
              >
                Protocol envelopes <ArrowUpRight aria-hidden="true" size={14} />
              </a>
              <a
                href="https://github.com/Alike001/metermesh/blob/main/packages/ai/src/schema.ts"
                rel="noreferrer"
                target="_blank"
              >
                Explanation output <ArrowUpRight aria-hidden="true" size={14} />
              </a>
            </div>
          </section>

          <section className="docs-section" id="trust" aria-labelledby="trust-title">
            <div className="docs-section-heading">
              <span>04</span>
              <div>
                <h2 id="trust-title">Trust boundary</h2>
                <p>Keep authority where it can be independently checked.</p>
              </div>
            </div>
            <div className="docs-trust-grid">
              <article>
                <span>Onchain authority</span>
                <h3>X Layer receipts are live truth.</h3>
                <p>
                  The current worker reads the public transaction and receipt directly from chain
                  1952. Future escrow and settlement state must also come from chain, and none is
                  inferred by this documentation or a database projection.
                </p>
                <dl>
                  <div>
                    <dt>Chain ID</dt>
                    <dd>1952</dd>
                  </div>
                  <div>
                    <dt>Asset</dt>
                    <dd>USDt0</dd>
                  </div>
                </dl>
              </article>
              <article>
                <span>Offchain coordination</span>
                <h3>Signed messages carry the work.</h3>
                <p>
                  XMTP carries private requests and deliveries. MeterMesh verifies signatures,
                  ordering, references, replay protection, and the canonical result hash. Exact
                  cumulative amounts are enforced in protocol tests while voucher execution stays
                  gated.
                </p>
                <dl>
                  <div>
                    <dt>Protocol</dt>
                    <dd>MeterMesh v1</dd>
                  </div>
                  <div>
                    <dt>Authorization</dt>
                    <dd>Buyer wallet</dd>
                  </div>
                </dl>
              </article>
            </div>
          </section>

          <section
            className="docs-section docs-machine"
            id="machine"
            aria-labelledby="machine-title"
          >
            <div className="docs-section-heading">
              <span>05</span>
              <div>
                <h2 id="machine-title">Machine access</h2>
                <p>One source of truth for agents, crawlers, and integration tools.</p>
              </div>
            </div>
            <div className="docs-artifact-list">
              {DOCUMENTATION_ARTIFACTS.map((artifact) => (
                <a href={artifact} key={artifact}>
                  <FileJson2 aria-hidden="true" size={18} />
                  <span>{artifact}</span>
                  <ArrowUpRight aria-hidden="true" size={15} />
                </a>
              ))}
              <a href="/evidence/captured-session.json">
                <FileJson2 aria-hidden="true" size={18} />
                <span>/evidence/captured-session.json</span>
                <ArrowUpRight aria-hidden="true" size={15} />
              </a>
            </div>
            <p className="docs-machine-note">
              OpenAPI describes public GET resources only. XMTP execution remains a signed envelope
              contract and is not presented as an HTTP endpoint.
            </p>
          </section>
        </main>

        {artifactError === null ? (
          <StatusRail statuses={statuses} />
        ) : (
          <aside className="docs-truth-rail docs-artifact-error" role="alert">
            <h2>Machine discovery unavailable</h2>
            <p>{artifactError}</p>
            <p>The human integration guide remains available. Do not infer runtime health.</p>
          </aside>
        )}
      </div>
      <footer className="docs-footer">
        <BrandMark />
        <p>Buyer-controlled metered work on X Layer.</p>
        <a href="https://github.com/Alike001/metermesh" rel="noreferrer" target="_blank">
          Inspect source <ArrowUpRight aria-hidden="true" size={14} />
        </a>
      </footer>
    </div>
  );
}
