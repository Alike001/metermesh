import { useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
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

import { createLiveEvidenceBundle, type LiveEvidenceBundle } from "../domain/live-evidence";
import { shortHash, type CapturedSession } from "../domain/session";
import { ANCHORED_LIVE_EVIDENCE, xLayerTestnetTransactionUrl } from "../domain/x-layer-evidence";
import { useAnchoredEvidence } from "../hooks/useAnchoredEvidence";
import { useCapturedSession } from "../hooks/useCapturedSession";
import { useLiveXmtp } from "../hooks/useLiveXmtp";
import { BrandMark } from "./BrandMark";
import { LiveXmtpPanel } from "./LiveXmtpPanel";
import { ProtocolDrawer } from "./ProtocolDrawer";
import { StatusMark } from "./StatusMark";

interface SessionWorkspaceProps {
  onBack: () => void;
}

type ReviewStatus = "pending" | "accepted" | "rejected";
type ActiveSource = "anchored" | "live";

interface ProofRecord {
  detail: string;
  id: string;
  label: string;
  protocol: string;
}

function formatTime(value: string): string {
  return new Date(value).toISOString().slice(11, 16) + " UTC";
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
  downloadJson("metermesh-" + session.session.id + "-offline-fixture.json", session);
}

function proofRecords(bundle: LiveEvidenceBundle): ProofRecord[] {
  return [
    {
      detail:
        "Buyer " +
        shortHash(bundle.request.envelope.signature.signer) +
        " signed request " +
        shortHash(bundle.request.carrierMessageId) +
        ".",
      id: "active-request",
      label: "Buyer request",
      protocol: "EIP-191 · XMTP",
    },
    {
      detail:
        "Seller " +
        shortHash(bundle.delivery.envelope.signature.signer) +
        " signed delivery " +
        shortHash(bundle.delivery.carrierMessageId) +
        " and bound it to the buyer request.",
      id: "active-delivery",
      label: "Seller delivery",
      protocol: "XMTP identity · EIP-191",
    },
    {
      detail:
        "Receipt block " +
        bundle.result.provenance.blockNumber +
        " reports " +
        bundle.result.status +
        " with " +
        bundle.result.provenance.confirmations +
        " confirmations.",
      id: "active-chain",
      label: "X Layer receipt",
      protocol: "Chain 1952 · RPC",
    },
    {
      detail:
        "The recomputed explanation hash matches " +
        shortHash(bundle.delivery.envelope.payload.resultHash) +
        " in the signed delivery.",
      id: "active-result",
      label: "Result binding",
      protocol: "MeterMesh v1",
    },
  ];
}

export function SessionWorkspace({ onBack }: SessionWorkspaceProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const acceptanceRef = useRef<HTMLLIElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [proofOpenOnMobile, setProofOpenOnMobile] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>("pending");
  const { requestState: fallbackState } = useCapturedSession(true);
  const anchoredEvidence = useAnchoredEvidence();
  const liveXmtp = useLiveXmtp();
  const liveSuccess = liveXmtp.state.status === "success" ? liveXmtp.state : null;
  const liveBundle = useMemo(
    () =>
      liveSuccess === null
        ? null
        : createLiveEvidenceBundle(liveSuccess.request, liveSuccess.delivery),
    [liveSuccess],
  );
  const anchoredBundle =
    anchoredEvidence.state.status === "success" ? anchoredEvidence.state.bundle : null;
  const activeBundle = liveBundle ?? anchoredBundle;
  const activeSource: ActiveSource = liveBundle === null ? "anchored" : "live";
  const fallbackSession = fallbackState.status === "success" ? fallbackState.data : null;
  const isPublishedAnchor =
    activeBundle?.anchorEvidenceHash === ANCHORED_LIVE_EVIDENCE.anchorEvidenceHash;

  useEffect(() => {
    setReviewStatus("pending");
  }, [activeBundle?.anchorEvidenceHash]);

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

  const renderActiveEvidence = () => {
    if (activeBundle === null && anchoredEvidence.state.status === "loading") {
      return (
        <div className="workspace-state" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="spin" size={28} />
          <h2>Verifying signed proof</h2>
          <p>The browser is checking both signatures, the result binding, and the anchor hash.</p>
        </div>
      );
    }

    if (activeBundle === null && anchoredEvidence.state.status === "error") {
      return (
        <div className="workspace-state workspace-state-error" role="alert">
          <AlertTriangle aria-hidden="true" size={28} />
          <h2>Signed proof could not be verified</h2>
          <p>{anchoredEvidence.state.message}</p>
          <button className="button button-primary" onClick={anchoredEvidence.reload} type="button">
            <RefreshCw aria-hidden="true" size={17} />
            Retry proof verification
          </button>
        </div>
      );
    }

    if (activeBundle === null) return null;

    const result = activeBundle.result;
    const sourceLabel = activeSource === "live" ? "Current live proof" : "Published anchored proof";
    const verificationLabel = activeSource === "live" ? "Verified live" : "Signature verified";

    return (
      <>
        <div className="active-proof-notice" data-testid="active-proof-notice">
          <Info aria-hidden="true" size={17} />
          <p>
            <strong>{sourceLabel}.</strong> Every section below refers to request{" "}
            {shortHash(activeBundle.request.envelope.messageId)}, delivery{" "}
            {shortHash(activeBundle.delivery.envelope.messageId)}, and transaction{" "}
            {shortHash(result.transactionHash)}.
          </p>
        </div>

        <ol className="message-list" aria-label="Active verified protocol messages">
          <li className="message-row message-row-buyer">
            <div className="message-actor">
              <span>Buyer</span>
              <time dateTime={activeBundle.request.envelope.createdAt}>
                {formatTime(activeBundle.request.envelope.createdAt)}
              </time>
            </div>
            <div className="message-body">
              <div className="message-label">
                <span>Signed work request</span>
                <StatusMark label={verificationLabel} status="verified" />
              </div>
              <p>
                Explain X Layer Testnet transaction {shortHash(result.transactionHash)} before I
                rely on its outcome.
              </p>
            </div>
          </li>
          <li className="message-row message-row-agent">
            <div className="message-actor">
              <span>Agent</span>
              <time dateTime={activeBundle.delivery.envelope.createdAt}>
                {formatTime(activeBundle.delivery.envelope.createdAt)}
              </time>
            </div>
            <div className="message-body">
              <div className="message-label">
                <span>Signed AI delivery</span>
                <StatusMark label={verificationLabel} status="verified" />
              </div>
              <p>{result.summary}</p>
              <p className="message-outcome">{result.outcome}</p>
              <div className="delivery-checks" aria-label="Deterministic delivery checks">
                <div>
                  <span>Receipt</span>
                  <strong>{result.status}</strong>
                </div>
                <div>
                  <span>Envelope signatures</span>
                  <strong>Valid</strong>
                </div>
                <div>
                  <span>Result hash</span>
                  <strong>Matches</strong>
                </div>
              </div>
            </div>
          </li>
        </ol>

        <section className="review-panel" aria-labelledby="review-title">
          <div>
            <p className="section-kicker">Decision-rule preview</p>
            <h2 id="review-title">Would this delivery earn one unit?</h2>
            <p>
              Test the accept or reject rule against this active proof. The preview is unsigned and
              cannot request a voucher, authorize payment, or move funds.
            </p>
          </div>
          <div className="review-actions">
            <button
              className={
                "button " + (reviewStatus === "accepted" ? "button-accepted" : "button-primary")
              }
              onClick={() => {
                updateReview("accepted");
              }}
              type="button"
            >
              <Check aria-hidden="true" size={17} />
              {reviewStatus === "accepted" ? "Would accept" : "Preview acceptance"}
            </button>
            <button
              className={
                "button button-secondary " + (reviewStatus === "rejected" ? "button-rejected" : "")
              }
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
      </>
    );
  };

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
          <h1>Verified X Layer transaction explanation</h1>
        </div>
        <div className="titlebar-actions">
          {activeBundle !== null && (
            <button
              className="button button-quiet"
              onClick={() => {
                downloadJson(
                  "metermesh-" + activeBundle.request.envelope.sessionId + "-signed-proof.json",
                  activeBundle,
                );
              }}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Export active proof
            </button>
          )}
          {fallbackSession !== null && (
            <button
              className="button button-quiet fallback-download"
              onClick={() => {
                downloadCapturedFixture(fallbackSession);
              }}
              type="button"
            >
              <Download aria-hidden="true" size={16} />
              Offline fallback
            </button>
          )}
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
              <strong>No voucher</strong>
            </span>
            <ChevronDown aria-hidden="true" size={16} />
          </button>
        </div>
      </div>

      <main className="workspace-grid">
        <section className="conversation-pane" aria-label="Verified work conversation">
          <div className="conversation-content" data-testid="conversation-content">
            <LiveXmtpPanel controller={liveXmtp} />
            {renderActiveEvidence()}
          </div>
        </section>

        <aside
          className={"proof-rail " + (proofOpenOnMobile ? "proof-rail-mobile-open" : "")}
          aria-label="Verification and protocol proof"
        >
          <div className="proof-rail-header">
            <div>
              <p className="section-kicker">Active proof</p>
              <h2>What the browser verified</h2>
            </div>
            <ShieldCheck aria-hidden="true" size={20} />
          </div>

          <div className="meter-summary">
            <span>Payment state</span>
            <strong data-testid="payment-state">No voucher</strong>
            <p>0 USDT0 authorized or moved by this verification path</p>
          </div>

          {activeBundle !== null ? (
            <>
              <ol className="proof-list">
                {proofRecords(activeBundle).map((record) => (
                  <li key={record.id}>
                    <StatusMark
                      label={activeSource === "live" ? "Verified live" : "Reverified locally"}
                      status="verified"
                    />
                    <h3>{record.label}</h3>
                    <p>{record.detail}</p>
                    <span>{record.protocol}</span>
                  </li>
                ))}
                <li className="anchored-proof-record">
                  <StatusMark
                    label={isPublishedAnchor ? "Published anchor matches" : "Anchor not published"}
                    status={isPublishedAnchor ? "verified" : "pending"}
                  />
                  <h3>X Layer proof anchor</h3>
                  {isPublishedAnchor ? (
                    <>
                      <p>
                        This active evidence hash {shortHash(activeBundle.anchorEvidenceHash)} is
                        committed by the published Testnet anchor transaction.
                      </p>
                      <div className="proof-evidence-links">
                        <a
                          href={xLayerTestnetTransactionUrl(
                            ANCHORED_LIVE_EVIDENCE.anchorTransactionHash,
                          )}
                          rel="noreferrer"
                          target="_blank"
                        >
                          View anchor transaction
                          <ArrowUpRight aria-hidden="true" size={13} />
                        </a>
                        <a href={ANCHORED_LIVE_EVIDENCE.proofPath} rel="noreferrer" target="_blank">
                          Inspect signed proof JSON
                          <ArrowUpRight aria-hidden="true" size={13} />
                        </a>
                      </div>
                    </>
                  ) : (
                    <p>
                      This fresh proof has a stable evidence hash, but no published anchor is
                      claimed for it. Export the signed proof to preserve it.
                    </p>
                  )}
                </li>
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
                  <span>Bound to {shortHash(activeBundle.anchorEvidenceHash)}</span>
                </li>
              </ol>

              <a
                className="fixture-reference"
                href={xLayerTestnetTransactionUrl(activeBundle.result.transactionHash)}
                rel="noreferrer"
                target="_blank"
              >
                <FileJson aria-hidden="true" size={17} />
                <div>
                  <span>Active X Layer transaction</span>
                  <code>{shortHash(activeBundle.result.transactionHash)}</code>
                </div>
                <ArrowUpRight aria-hidden="true" size={14} />
              </a>
            </>
          ) : (
            <div className="proof-rail-loading" role="status">
              <LoaderCircle aria-hidden="true" className="spin" size={18} />
              Verifying active proof
            </div>
          )}

          <div className="settlement-control">
            <div className="settlement-heading">
              <StatusMark label="Compatibility gate" status="blocked" />
              <strong>Future MPP adapter</strong>
            </div>
            <button className="button button-disabled" disabled type="button">
              <LockKeyhole aria-hidden="true" size={17} />
              Payment outside v1
            </button>
            <p>
              No voucher, escrow, settlement, or wallet mutation is part of the current product.
            </p>
          </div>
        </aside>
      </main>

      <div className="workspace-footnote">
        <MessageSquareText aria-hidden="true" size={15} />
        <span>
          Browser signatures, XMTP transport, X Layer receipts, AI output, and proof export are
          working. MPP settlement remains gated.
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
