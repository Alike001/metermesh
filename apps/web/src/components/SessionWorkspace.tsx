import { useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  CircleSlash2,
  Code2,
  Download,
  FileJson,
  Info,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";

import { formatAtomicAmount, shortHash, type CapturedSession } from "../domain/session";
import { useCapturedSession } from "../hooks/useCapturedSession";
import { BrandMark } from "./BrandMark";
import { ProtocolDrawer } from "./ProtocolDrawer";
import { StatusMark } from "./StatusMark";

interface SessionWorkspaceProps {
  onBack: () => void;
}

type ReviewStatus = "pending" | "accepted" | "rejected";

function formatTime(value: string): string {
  return `${new Date(value).toISOString().slice(11, 16)} UTC`;
}

function exportEvidence(session: CapturedSession, reviewStatus: ReviewStatus) {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    localReviewStatus: reviewStatus,
    session,
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `metermesh-${session.session.id}-evidence.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SessionWorkspace({ onBack }: SessionWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const acceptanceRef = useRef<HTMLLIElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [evidenceVisible, setEvidenceVisible] = useState(true);
  const [proofOpenOnMobile, setProofOpenOnMobile] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const { reload, requestState } = useCapturedSession(evidenceVisible);

  const amountDue = useMemo(() => {
    if (requestState.status !== "success" || reviewStatus !== "accepted") return "0";
    return requestState.data.session.unitPriceAtomic;
  }, [requestState, reviewStatus]);

  const { contextSafe } = useGSAP({ scope: workspaceRef });

  const updateReview = contextSafe((nextStatus: ReviewStatus) => {
    setReviewStatus(nextStatus);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        acceptanceRef.current,
        { backgroundColor: "rgba(36, 87, 214, 0.11)" },
        { backgroundColor: "rgba(255, 255, 255, 0)", duration: 0.18, ease: "expo.out" },
      );
    }
  });

  const restoreEvidence = () => {
    setEvidenceVisible(true);
    setReviewStatus("pending");
  };

  const removeEvidence = () => {
    setEvidenceVisible(false);
    setReviewStatus("pending");
  };

  const renderConversation = () => {
    if (!evidenceVisible || requestState.status === "idle") {
      return (
        <div className="workspace-state" data-testid="empty-state">
          <CircleSlash2 aria-hidden="true" size={28} />
          <h2>No evidence is loaded</h2>
          <p>
            Load the captured local protocol run to inspect the request, delivery, and billing
            proof.
          </p>
          <button className="button button-primary" onClick={restoreEvidence} type="button">
            Load captured run
          </button>
        </div>
      );
    }

    if (requestState.status === "loading") {
      return (
        <div className="workspace-state" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="spin" size={28} />
          <h2>Loading captured evidence</h2>
          <p>The interface is reading the checked-in local protocol record.</p>
        </div>
      );
    }

    if (requestState.status === "error") {
      return (
        <div className="workspace-state workspace-state-error" role="alert">
          <AlertTriangle aria-hidden="true" size={28} />
          <h2>Evidence could not be loaded</h2>
          <p>{requestState.message}</p>
          <button className="button button-primary" onClick={reload} type="button">
            <RefreshCw aria-hidden="true" size={17} />
            Retry evidence load
          </button>
        </div>
      );
    }

    const { data } = requestState;

    return (
      <div className="conversation-content" data-testid="conversation-content">
        <div className="capture-notice">
          <Info aria-hidden="true" size={17} />
          <p>
            <strong>Captured local protocol run.</strong> No network call, AI-provider response, or
            movement of funds is represented here.
          </p>
        </div>

        <ol className="message-list" aria-label="Captured protocol messages">
          {data.messages.map((message) => (
            <li className={`message-row message-row-${message.actor}`} key={message.id}>
              <div className="message-actor">
                <span>{message.actor === "buyer" ? "You" : "Agent"}</span>
                <time dateTime={message.occurredAt}>{formatTime(message.occurredAt)}</time>
              </div>
              <div className="message-body">
                <div className="message-label">
                  <span>{message.label}</span>
                  <StatusMark label="Verified locally" status="verified" />
                </div>
                <p>{message.body}</p>
                {message.actor === "agent" && (
                  <div className="delivery-checks" aria-label="Deterministic delivery checks">
                    {data.result.checks.map((check) => (
                      <div key={check.label}>
                        <span>{check.label}</span>
                        <strong>{check.result}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        <section className="review-panel" aria-labelledby="review-title">
          <div>
            <p className="section-kicker">Buyer decision</p>
            <h2 id="review-title">Did this delivery earn one unit?</h2>
            <p>
              This records a local review decision only. Voucher signing stays disabled until the X
              Layer Testnet MPP gate is cleared.
            </p>
          </div>
          <div className="review-actions">
            <button
              className={`button ${reviewStatus === "accepted" ? "button-accepted" : "button-primary"}`}
              onClick={() => {
                updateReview("accepted");
              }}
              type="button"
            >
              <Check aria-hidden="true" size={17} />
              {reviewStatus === "accepted" ? "Accepted locally" : "Accept local delivery"}
            </button>
            <button
              className={`button button-secondary ${reviewStatus === "rejected" ? "button-rejected" : ""}`}
              onClick={() => {
                updateReview("rejected");
              }}
              type="button"
            >
              <X aria-hidden="true" size={17} />
              {reviewStatus === "rejected" ? "Rejected locally" : "Reject local delivery"}
            </button>
            {reviewStatus !== "pending" && (
              <button
                className="text-action"
                onClick={() => {
                  updateReview("pending");
                }}
                type="button"
              >
                <RotateCcw aria-hidden="true" size={15} />
                Reset decision
              </button>
            )}
          </div>
        </section>
      </div>
    );
  };

  const successfulSession = requestState.status === "success" ? requestState.data : null;

  return (
    <div className="workspace" ref={workspaceRef}>
      <header className="workspace-header">
        <div className="workspace-brand-group">
          <button
            className="icon-button"
            onClick={onBack}
            type="button"
            aria-label="Back to landing page"
          >
            <ArrowLeft aria-hidden="true" size={18} />
          </button>
          <BrandMark />
        </div>
        <div className="workspace-header-actions">
          <span className="network-label">
            <span className="status-dot status-dot-amber" />X Layer Testnet · 1952
          </span>
          <button
            aria-label="Protocol details"
            className="button button-quiet"
            onClick={() => {
              setDrawerOpen(true);
            }}
            type="button"
          >
            <Code2 aria-hidden="true" size={16} />
            <span>Protocol details</span>
          </button>
        </div>
      </header>

      <div className="workspace-titlebar">
        <div>
          <p className="section-kicker">Protocol conversation</p>
          <h1>{successfulSession?.session.title ?? "Metered work session"}</h1>
        </div>
        <div className="titlebar-actions">
          {successfulSession !== null && (
            <button
              className="button button-quiet"
              onClick={() => {
                exportEvidence(successfulSession, reviewStatus);
              }}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Export evidence
            </button>
          )}
          <button
            aria-expanded={proofOpenOnMobile}
            className="button button-quiet mobile-proof-toggle"
            onClick={() => {
              setProofOpenOnMobile((value) => !value);
            }}
            type="button"
          >
            Proof rail
            <ChevronDown aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <main className="workspace-grid">
        <section className="conversation-pane" aria-label="Metered session conversation">
          {renderConversation()}
        </section>

        <aside
          className={`proof-rail ${proofOpenOnMobile ? "proof-rail-mobile-open" : ""}`}
          aria-label="Payment and protocol proof"
        >
          <div className="proof-rail-header">
            <div>
              <p className="section-kicker">Payment proof</p>
              <h2>What the buyer owes</h2>
            </div>
            <ShieldCheck aria-hidden="true" size={20} />
          </div>

          <div className="meter-summary">
            <span>Locally accepted</span>
            <strong data-testid="amount-due">{formatAtomicAmount(amountDue)} USDT0</strong>
            <p>
              {successfulSession === null
                ? "No session evidence loaded."
                : `${formatAtomicAmount(successfulSession.session.capAtomic)} USDT0 session cap`}
            </p>
          </div>

          <ol className="proof-list">
            {successfulSession?.evidence.map((record) => (
              <li key={record.id}>
                <StatusMark label="Verified" status="verified" />
                <h3>{record.label}</h3>
                <p>{record.detail}</p>
                <span>{record.protocol}</span>
              </li>
            ))}
            <li ref={acceptanceRef} data-testid="acceptance-proof">
              <StatusMark
                label={
                  reviewStatus === "accepted"
                    ? "Accepted locally"
                    : reviewStatus === "rejected"
                      ? "Rejected locally"
                      : "Pending buyer"
                }
                status={reviewStatus === "pending" ? "pending" : "verified"}
              />
              <h3>Buyer review</h3>
              <p>
                {reviewStatus === "accepted"
                  ? "One local unit is marked accepted. No voucher has been signed."
                  : reviewStatus === "rejected"
                    ? "The local delivery is rejected and the amount stays at zero."
                    : "The delivery does not affect billing until the buyer accepts it."}
              </p>
              <span>Local interface state</span>
            </li>
            <li>
              <StatusMark label="Compatibility gate" status="blocked" />
              <h3>X Layer settlement</h3>
              <p>OKX MPP session mutation remains disabled until chain 1952 support is proven.</p>
              <span>No funds moved</span>
            </li>
          </ol>

          {successfulSession !== null && (
            <div className="fixture-reference">
              <FileJson aria-hidden="true" size={17} />
              <div>
                <span>Fixture transaction reference</span>
                <code>{shortHash(successfulSession.result.fixtureTransactionHash)}</code>
              </div>
            </div>
          )}

          <div className="settlement-control">
            <button className="button button-disabled" disabled type="button">
              <LockKeyhole aria-hidden="true" size={17} />
              Settle on X Layer
            </button>
            <p>Paused by the approved architecture gate. This button can’t create a transaction.</p>
          </div>

          <button
            className="proof-data-action"
            onClick={successfulSession === null ? restoreEvidence : removeEvidence}
            type="button"
          >
            {successfulSession === null ? "Load captured evidence" : "Remove captured evidence"}
          </button>
        </aside>
      </main>

      <div className="workspace-footnote">
        <MessageSquareText aria-hidden="true" size={15} />
        <span>
          The XMTP Node carrier and AI provider are verified. Buyer browser connection and live
          orchestration are the next integration slice.
        </span>
      </div>

      <ProtocolDrawer
        onClose={() => {
          setDrawerOpen(false);
        }}
        open={drawerOpen}
      />
    </div>
  );
}
