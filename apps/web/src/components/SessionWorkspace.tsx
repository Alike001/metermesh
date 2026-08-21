import { useRef, useState } from "react";
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

import { createLiveEvidenceBundle } from "../domain/live-evidence";
import { shortHash, type CapturedSession } from "../domain/session";
import { useCapturedSession } from "../hooks/useCapturedSession";
import { useLiveXmtp, type LiveXmtpState } from "../hooks/useLiveXmtp";
import { BrandMark } from "./BrandMark";
import { LiveXmtpPanel } from "./LiveXmtpPanel";
import { ProtocolDrawer } from "./ProtocolDrawer";
import { StatusMark } from "./StatusMark";

interface SessionWorkspaceProps {
  onBack: () => void;
}

type ReviewStatus = "pending" | "accepted" | "rejected";
type LiveSuccessState = Extract<LiveXmtpState, { status: "success" }>;

interface ProofRecord {
  detail: string;
  id: string;
  label: string;
  protocol: string;
}

function formatTime(value: string): string {
  return `${new Date(value).toISOString().slice(11, 16)} UTC`;
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadCapturedFixture(session: CapturedSession) {
  downloadJson(`metermesh-${session.session.id}-offline-fixture.json`, session);
}

function liveProofRecords(state: LiveSuccessState): ProofRecord[] {
  return [
    {
      detail: `Buyer ${shortHash(state.request.envelope.signature.signer)} signed the request carried as ${shortHash(state.request.carrierMessageId)}.`,
      id: "live-request",
      label: "Buyer request",
      protocol: "EIP-191 · XMTP",
    },
    {
      detail: `The seller signer returned ${shortHash(state.delivery.carrierMessageId)} after an online XMTP authorization check and bound it to the buyer request.`,
      id: "live-delivery",
      label: "Seller delivery",
      protocol: "XMTP identity · EIP-191",
    },
    {
      detail: `Receipt block ${state.delivery.result.provenance.blockNumber} has ${state.delivery.result.provenance.confirmations} confirmations.`,
      id: "live-chain",
      label: "X Layer receipt",
      protocol: "Chain 1952 · RPC",
    },
    {
      detail: `The recomputed explanation hash matches ${shortHash(state.delivery.envelope.payload.resultHash)} in the signed delivery.`,
      id: "live-result",
      label: "Result binding",
      protocol: "MeterMesh v1",
    },
  ];
}

export function SessionWorkspace({ onBack }: SessionWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const acceptanceRef = useRef<HTMLLIElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [evidenceVisible, setEvidenceVisible] = useState(true);
  const [proofOpenOnMobile, setProofOpenOnMobile] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const { reload, requestState } = useCapturedSession(evidenceVisible);
  const liveXmtp = useLiveXmtp();
  const liveSuccess = liveXmtp.state.status === "success" ? liveXmtp.state : null;

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
        <LiveXmtpPanel controller={liveXmtp} />
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
            <p className="section-kicker">Decision-rule preview</p>
            <h2 id="review-title">Would this delivery earn one unit?</h2>
            <p>
              Test the accept or reject rule locally. This preview is unsigned and cannot request a
              voucher, authorize payment, or move funds.
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
              {reviewStatus === "accepted" ? "Would accept" : "Preview acceptance"}
            </button>
            <button
              className={`button button-secondary ${reviewStatus === "rejected" ? "button-rejected" : ""}`}
              onClick={() => {
                updateReview("rejected");
              }}
              type="button"
            >
              <X aria-hidden="true" size={17} />
              {reviewStatus === "rejected" ? "Would reject" : "Preview rejection"}
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
          <h1>{successfulSession?.session.title ?? "Verified work session"}</h1>
        </div>
        <div className="titlebar-actions">
          {liveSuccess !== null ? (
            <button
              className="button button-quiet"
              onClick={() => {
                const bundle = createLiveEvidenceBundle(liveSuccess.request, liveSuccess.delivery);
                downloadJson(
                  `metermesh-${liveSuccess.request.envelope.sessionId}-signed-proof.json`,
                  bundle,
                );
              }}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Export signed proof
            </button>
          ) : successfulSession !== null ? (
            <button
              className="button button-quiet"
              onClick={() => {
                downloadCapturedFixture(successfulSession);
              }}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Download offline fixture
            </button>
          ) : null}
          <button
            aria-label="Proof rail"
            aria-expanded={proofOpenOnMobile}
            className="button button-quiet mobile-proof-toggle"
            onClick={() => {
              setProofOpenOnMobile((value) => !value);
            }}
            type="button"
          >
            <span className="mobile-proof-summary" data-testid="mobile-proof-summary">
              <span>Proof</span>
              <strong>{liveSuccess === null ? "No voucher" : "Live verified · no voucher"}</strong>
            </span>
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
              <p className="section-kicker">Verification proof</p>
              <h2>What the browser verified</h2>
            </div>
            <ShieldCheck aria-hidden="true" size={20} />
          </div>

          <div className="meter-summary">
            <span>Payment state</span>
            <strong data-testid="payment-state">No voucher</strong>
            <p>0 USDT0 authorized or moved by this verification path</p>
          </div>

          <ol className="proof-list">
            {liveSuccess === null
              ? successfulSession?.evidence.map((record) => (
                  <li key={record.id}>
                    <StatusMark label="Verified locally" status="verified" />
                    <h3>{record.label}</h3>
                    <p>{record.detail}</p>
                    <span>{record.protocol} · offline fixture</span>
                  </li>
                ))
              : liveProofRecords(liveSuccess).map((record) => (
                  <li key={record.id}>
                    <StatusMark label="Verified live" status="verified" />
                    <h3>{record.label}</h3>
                    <p>{record.detail}</p>
                    <span>{record.protocol}</span>
                  </li>
                ))}
            <li ref={acceptanceRef} data-testid="acceptance-proof">
              <StatusMark
                label={
                  reviewStatus === "accepted"
                    ? "Accepted preview"
                    : reviewStatus === "rejected"
                      ? "Rejected preview"
                      : "Preview pending"
                }
                status={reviewStatus === "pending" ? "pending" : "verified"}
              />
              <h3>Unsigned decision preview</h3>
              <p>
                {reviewStatus === "accepted"
                  ? "The buyer marked this delivery useful in an unsigned preview. No voucher was requested or signed."
                  : reviewStatus === "rejected"
                    ? "The buyer rejected this delivery in an unsigned preview. No voucher was requested or signed."
                    : "This local preview records no payment state and cannot authorize funds."}
              </p>
              <span>Unsigned browser-only state</span>
            </li>
            <li>
              <StatusMark label="Compatibility gate" status="blocked" />
              <h3>Future MPP adapter</h3>
              <p>
                V1 records and exports acceptance evidence without creating payment state. A future
                MPP adapter can consume this verified record after chain 1952 support is confirmed.
              </p>
              <span>Deferred, no funds moved</span>
            </li>
          </ol>

          {liveSuccess !== null ? (
            <div className="fixture-reference">
              <FileJson aria-hidden="true" size={17} />
              <div>
                <span>Live X Layer transaction</span>
                <code>{shortHash(liveSuccess.delivery.result.transactionHash)}</code>
              </div>
            </div>
          ) : successfulSession !== null ? (
            <div className="fixture-reference">
              <FileJson aria-hidden="true" size={17} />
              <div>
                <span>Offline fixture transaction reference</span>
                <code>{shortHash(successfulSession.result.fixtureTransactionHash)}</code>
              </div>
            </div>
          ) : null}

          <div className="settlement-control">
            <button className="button button-disabled" disabled type="button">
              <LockKeyhole aria-hidden="true" size={17} />
              Payment outside v1
            </button>
            <p>
              No voucher, escrow, settlement, or wallet mutation is part of the current product.
            </p>
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
          Browser wallet, public XMTP worker, X Layer receipt, AI output, and PostgreSQL recovery
          have passed. OKX MPP mutation remains gated.
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
