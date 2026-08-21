import { useEffect, useRef } from "react";
import { ArrowDown, ArrowRight, Database, LockKeyhole, ShieldCheck, X } from "lucide-react";

interface ProtocolDrawerProps {
  onClose: () => void;
  open: boolean;
}

const forwardPath = ["Buyer wallet", "Browser", "XMTP", "Worker", "PostgreSQL", "X Layer RPC"];
const reversePath = ["X Layer receipt", "Worker", "PostgreSQL", "XMTP", "Browser proof"];
const plannedPaymentPath = ["MPP open", "Buyer voucher", "MPP close", "Escrow receipt"];

export function ProtocolDrawer({ onClose, open }: ProtocolDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="drawer-layer">
      <button className="drawer-backdrop" onClick={onClose} aria-label="Close protocol details" />
      <aside
        aria-labelledby="protocol-drawer-title"
        aria-modal="true"
        className="protocol-drawer"
        role="dialog"
      >
        <header className="drawer-header">
          <div>
            <p className="section-kicker">Protocol detail</p>
            <h2 id="protocol-drawer-title">Where the evidence lives</h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
            aria-label="Close protocol details"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>

        <div className="drawer-content">
          <section aria-labelledby="forward-path-title" className="drawer-section">
            <div className="drawer-section-heading">
              <ArrowRight aria-hidden="true" size={18} />
              <h3 id="forward-path-title">Verified live path</h3>
            </div>
            <p>
              A buyer signs one request. The worker durably verifies it, reads X Layer, and creates
              a signed explanation without authorizing payment.
            </p>
            <ol className="path-list">
              {forwardPath.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="reverse-path-title" className="drawer-section">
            <div className="drawer-section-heading">
              <ArrowDown aria-hidden="true" size={18} />
              <h3 id="reverse-path-title">Verified return path</h3>
            </div>
            <p>
              The real receipt and seller-signed result return through PostgreSQL and XMTP. The
              browser verifies every binding before showing proof.
            </p>
            <ol className="path-list">
              {reversePath.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="planned-path-title" className="drawer-section">
            <div className="drawer-section-heading">
              <LockKeyhole aria-hidden="true" size={18} />
              <h3 id="planned-path-title">Planned payment path</h3>
            </div>
            <p>
              These steps stay unavailable until OKX confirms MPP session support for X Layer
              Testnet chain 1952 and one real session passes end to end.
            </p>
            <ol className="path-list">
              {plannedPaymentPath.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </section>

          <section className="trust-boundary" aria-labelledby="trust-title">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <h3 id="trust-title">Trust boundary</h3>
              <p>
                Signed messages and chain receipts are authoritative for the live verifier. No
                frontend or database state can create a voucher or settlement.
              </p>
            </div>
          </section>

          <section className="storage-map" aria-labelledby="storage-title">
            <div className="drawer-section-heading">
              <Database aria-hidden="true" size={18} />
              <h3 id="storage-title">State placement</h3>
            </div>
            <dl>
              <div>
                <dt>Onchain</dt>
                <dd>The supplied X Layer transaction and confirmed receipt are read-only truth.</dd>
              </div>
              <div>
                <dt>Offchain</dt>
                <dd>
                  XMTP messages, signed delivery evidence, PostgreSQL recovery, and interface state.
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </aside>
    </div>
  );
}
