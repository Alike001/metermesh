import { useEffect, useRef } from "react";
import { ArrowDown, ArrowRight, Database, ShieldCheck, X } from "lucide-react";

interface ProtocolDrawerProps {
  onClose: () => void;
  open: boolean;
}

const forwardPath = ["Buyer", "Frontend", "Backend", "OKX API", "X Layer", "Escrow"];
const reversePath = ["Escrow event", "Indexer", "PostgreSQL", "Backend", "Proof rail"];

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
              <h3 id="forward-path-title">Forward path</h3>
            </div>
            <p>
              A buyer requests work, accepts useful delivery, and authorizes only the cumulative
              amount earned.
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
              <h3 id="reverse-path-title">Reverse path</h3>
            </div>
            <p>
              Chain events are indexed once, stored durably, and returned to the interface as fast
              proof reads.
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

          <section className="trust-boundary" aria-labelledby="trust-title">
            <ShieldCheck aria-hidden="true" size={22} />
            <div>
              <h3 id="trust-title">Trust boundary</h3>
              <p>
                Signed messages and chain receipts are authoritative. The database is a recoverable
                index and never overrides settlement truth.
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
                <dd>Escrow deposit, settled amount, close state, and final receipt.</dd>
              </div>
              <div>
                <dt>Offchain</dt>
                <dd>
                  XMTP messages, delivery evidence, cached event projections, and interface state.
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </aside>
    </div>
  );
}
