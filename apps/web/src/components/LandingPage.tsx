import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  CircleDot,
  LockKeyhole,
  MessageSquareText,
} from "lucide-react";

import { BrandMark } from "./BrandMark";

interface LandingPageProps {
  onOpenWorkspace: () => void;
}

const mechanismSteps = [
  {
    detail: "The buyer wallet signs a versioned request for one X Layer transaction.",
    label: "Sign one request",
  },
  {
    detail: "XMTP carries the request and seller-signed result through a durable worker.",
    label: "Verify work over XMTP",
  },
  {
    detail:
      "The interface records the buyer's deterministic review without creating payment state.",
    label: "Preview buyer acceptance",
  },
  {
    detail: "The browser exports a signed request, delivery, result hash, and X Layer provenance.",
    label: "Export signed proof",
  },
];

const proofItems = [
  ["Signed messages", "The live request and delivery carry re-runnable EIP-191 signatures."],
  ["Buyer control", "The public verifier cannot create a voucher or an amount owed."],
  ["Deterministic checks", "The result must match the signed request and real X Layer receipt."],
  [
    "Durable recovery",
    "PostgreSQL outbox state survives retries, duplicates, and worker restarts.",
  ],
];

export function LandingPage({ onOpenWorkspace }: LandingPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      gsap.fromTo(
        "[data-reveal]",
        { opacity: 0, y: 14 },
        { duration: 0.42, ease: "expo.out", opacity: 1, stagger: 0.055, y: 0 },
      );
    },
    { scope: pageRef },
  );

  const inspectEvidence = () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document
      .querySelector("#evidence")
      ?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="landing-page" ref={pageRef}>
      <header className="site-header" data-reveal>
        <a className="brand-link" href="#top" aria-label="MeterMesh home">
          <BrandMark />
        </a>
        <nav aria-label="Primary navigation">
          <a href="#mechanism">Mechanism</a>
          <a href="#evidence">Evidence</a>
          <a href="/docs/">Docs</a>
          <a href="https://github.com/Alike001/metermesh" rel="noreferrer" target="_blank">
            Source
          </a>
        </nav>
        <button className="header-cta" onClick={onOpenWorkspace} type="button">
          Open workspace
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      </header>

      <main id="top">
        <section className="hero-section">
          <div className="hero-copy">
            <p className="section-kicker" data-reveal>
              Verifiable agent work on X Layer
            </p>
            <h1 data-reveal>
              <span>AI work over messages.</span> <span>X Layer proves the result.</span>
            </h1>
            <p className="hero-support" data-reveal>
              The live product proves the signed path from a buyer wallet through XMTP, PostgreSQL,
              an X Layer receipt, and an AI result. The buyer can review and export the proof
              without authorizing payment.
            </p>
            <div className="hero-actions" data-reveal>
              <button className="button button-primary" onClick={onOpenWorkspace} type="button">
                Open live verifier
                <ArrowRight aria-hidden="true" size={18} />
              </button>
              <button className="text-action" onClick={inspectEvidence} type="button">
                Inspect real evidence
                <ArrowDownRight aria-hidden="true" size={17} />
              </button>
            </div>
            <p className="availability-note" data-reveal>
              <LockKeyhole aria-hidden="true" size={15} />
              V1 creates no voucher, settlement, or payment. MPP is a future adapter.
            </p>
          </div>

          <div
            className="session-anatomy"
            data-reveal
            aria-label="MeterMesh session anatomy preview"
          >
            <div className="anatomy-header">
              <div>
                <p>Session anatomy</p>
                <span>Buyer-controlled evidence</span>
              </div>
              <CircleDot aria-hidden="true" size={18} />
            </div>
            <ol className="anatomy-list">
              <li>
                <span className="anatomy-index">01</span>
                <div>
                  <strong>Request</strong>
                  <p>Buyer defines the work and the acceptance boundary.</p>
                </div>
                <span className="anatomy-state">Signed</span>
              </li>
              <li>
                <span className="anatomy-index">02</span>
                <div>
                  <strong>Delivery</strong>
                  <p>Agent returns work with evidence that references the request.</p>
                </div>
                <span className="anatomy-state">Verified</span>
              </li>
              <li>
                <span className="anatomy-index">03</span>
                <div>
                  <strong>Acceptance</strong>
                  <p>Buyer records whether the delivery is useful.</p>
                </div>
                <span className="anatomy-state anatomy-state-blocked">Preview</span>
              </li>
              <li>
                <span className="anatomy-index">04</span>
                <div>
                  <strong>Proof export</strong>
                  <p>Signed evidence can be checked again outside the session.</p>
                </div>
                <span className="anatomy-state">Portable</span>
              </li>
            </ol>
            <div className="anatomy-footer">
              <MessageSquareText aria-hidden="true" size={17} />
              <span>Messages carry the work. X Layer carries evidence truth.</span>
            </div>
          </div>
        </section>

        <section className="mechanism-section" id="mechanism" aria-labelledby="mechanism-title">
          <div className="section-heading" data-reveal>
            <p className="section-kicker">One request, one clear proof</p>
            <h2 id="mechanism-title">Useful work leaves an audit trail.</h2>
          </div>
          <ol className="mechanism-grid">
            {mechanismSteps.map((step, index) => (
              <li key={step.label} data-reveal>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.label}</h3>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="evidence-section" id="evidence" aria-labelledby="evidence-title">
          <div className="evidence-intro" data-reveal>
            <p className="section-kicker">Proof before polish</p>
            <h2 id="evidence-title">Every explanation has a source.</h2>
            <p>
              The interface exposes the signed request, verified delivery, X Layer receipt, local
              decision preview, and the exact boundary where payment remains outside the v1 product.
            </p>
          </div>
          <div className="proof-band">
            {proofItems.map(([title, detail]) => (
              <article key={title} data-reveal>
                <Check aria-hidden="true" size={18} />
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
          <div className="integration-status" data-reveal>
            <div>
              <span className="status-dot status-dot-green" />
              <div>
                <strong>X Layer receipt reads</strong>
                <p>Real chain 1952 transaction facts anchor the explanation.</p>
              </div>
            </div>
            <div>
              <span className="status-dot status-dot-green" />
              <div>
                <strong>Signed XMTP delivery</strong>
                <p>Buyer and seller envelopes, result hashes, and replay checks are live.</p>
              </div>
            </div>
            <div>
              <span className="status-dot status-dot-amber" />
              <div>
                <strong>OKX MPP adapter</strong>
                <p>Deferred until official chain 1952 session support is confirmed.</p>
              </div>
            </div>
            <div>
              <span className="status-dot status-dot-amber" />
              <div>
                <strong>Proof anchor source</strong>
                <p>
                  One signed live proof is anchored on Testnet. MPP payment writes remain gated.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="closing-section" data-reveal>
          <div>
            <p className="section-kicker">Inspect the product surface</p>
            <h2>See the work and the proof in one place.</h2>
          </div>
          <button className="button button-inverse" onClick={onOpenWorkspace} type="button">
            Open live verifier
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </section>
      </main>

      <footer className="site-footer">
        <BrandMark />
        <p>Verifiable AI work over XMTP, grounded in X Layer receipts.</p>
        <a href="https://github.com/Alike001/metermesh" rel="noreferrer" target="_blank">
          View source
        </a>
      </footer>
    </div>
  );
}
