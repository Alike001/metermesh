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
    detail: "One deposit sets the maximum exposure before any work begins.",
    label: "Fund one capped session",
  },
  {
    detail: "The buyer and agent exchange signed work envelopes over XMTP.",
    label: "Request work over XMTP",
  },
  {
    detail: "Only buyer-accepted delivery advances the cumulative voucher.",
    label: "Accept useful deliveries",
  },
  {
    detail: "The highest accepted voucher settles once through OKX Payments.",
    label: "Settle once on X Layer",
  },
];

const proofItems = [
  ["Signed messages", "Every request, delivery, and acceptance has a verifiable envelope."],
  ["Buyer control", "Delivery alone never creates an amount owed."],
  ["Cumulative billing", "One monotonic voucher replaces repeated per-message transfers."],
  ["Recoverable proof", "Indexed state can be rebuilt from signed messages and chain events."],
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
              Metered agent commerce on X Layer
            </p>
            <h1 data-reveal>
              <span>AI work over messages,</span> <span>paid only when accepted.</span>
            </h1>
            <p className="hero-support" data-reveal>
              MeterMesh connects XMTP-delivered AI work to an OKX metered payment session and
              settles the accepted amount on X Layer.
            </p>
            <div className="hero-actions" data-reveal>
              <button className="button button-primary" onClick={onOpenWorkspace} type="button">
                Open metered session
                <ArrowRight aria-hidden="true" size={18} />
              </button>
              <button className="text-action" onClick={inspectEvidence} type="button">
                Inspect real evidence
                <ArrowDownRight aria-hidden="true" size={17} />
              </button>
            </div>
            <p className="availability-note" data-reveal>
              <LockKeyhole aria-hidden="true" size={15} />
              Settlement stays paused until OKX MPP session support for X Layer Testnet is proven.
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
                <span>Buyer-controlled billing</span>
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
                  <p>Buyer decides if the delivery advances the amount owed.</p>
                </div>
                <span className="anatomy-state">Controlled</span>
              </li>
              <li>
                <span className="anatomy-index">04</span>
                <div>
                  <strong>Settlement</strong>
                  <p>Highest accepted voucher settles through OKX on X Layer.</p>
                </div>
                <span className="anatomy-state anatomy-state-blocked">Gated</span>
              </li>
            </ol>
            <div className="anatomy-footer">
              <MessageSquareText aria-hidden="true" size={17} />
              <span>Messages carry the work. X Layer carries settlement truth.</span>
            </div>
          </div>
        </section>

        <section className="mechanism-section" id="mechanism" aria-labelledby="mechanism-title">
          <div className="section-heading" data-reveal>
            <p className="section-kicker">One session, one clear rule</p>
            <h2 id="mechanism-title">Useful work advances the meter.</h2>
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
            <h2 id="evidence-title">Every amount has a reason.</h2>
            <p>
              The interface exposes the exact relationship between a work request, its delivery,
              buyer acceptance, and the final chain receipt.
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
                <strong>OKX service authentication</strong>
                <p>Verified with an authenticated read-only capability request.</p>
              </div>
            </div>
            <div>
              <span className="status-dot status-dot-green" />
              <div>
                <strong>MPP session status route</strong>
                <p>Verified without opening a channel or moving funds.</p>
              </div>
            </div>
            <div>
              <span className="status-dot status-dot-amber" />
              <div>
                <strong>X Layer Testnet settlement</strong>
                <p>Held behind a compatibility gate until chain 1952 support is confirmed.</p>
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
            Open metered session
            <ArrowRight aria-hidden="true" size={18} />
          </button>
        </section>
      </main>

      <footer className="site-footer">
        <BrandMark />
        <p>Buyer-controlled metered payments for AI work over XMTP on X Layer.</p>
        <a href="https://github.com/Alike001/metermesh" rel="noreferrer" target="_blank">
          View source
        </a>
      </footer>
    </div>
  );
}
