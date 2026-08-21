import { useState } from "react";
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  MessageSquareText,
  PlugZap,
  RotateCcw,
} from "lucide-react";

import { shortHash } from "../domain/session";
import { type LiveXmtpController } from "../hooks/useLiveXmtp";
import { StatusMark } from "./StatusMark";

export const EXAMPLE_APPROVAL_TRANSACTION_HASH =
  "0xf0bbcf38db1ee7935111b2be46fd1062d097e0461b2f48f34b9a5ba17482fafd";

interface LiveXmtpPanelProps {
  controller: LiveXmtpController;
}

export function LiveXmtpPanel({ controller }: LiveXmtpPanelProps) {
  const [transactionHash, setTransactionHash] = useState(EXAMPLE_APPROVAL_TRANSACTION_HASH);
  const { connect, disconnect, request, reset, state } = controller;
  const busy =
    state.status === "connecting" || state.status === "sending" || state.status === "waiting";
  const connected =
    state.status === "ready" ||
    state.status === "sending" ||
    state.status === "waiting" ||
    state.status === "success";

  return (
    <section className="live-xmtp-panel" aria-labelledby="live-xmtp-title">
      <div className="live-xmtp-heading">
        <div>
          <p className="section-kicker">Live transport verification</p>
          <h2 id="live-xmtp-title">Request one real X Layer explanation</h2>
        </div>
        <StatusMark
          label={connected ? "XMTP connected" : "Nonbillable verifier"}
          status={connected ? "verified" : "pending"}
        />
      </div>
      <p className="live-xmtp-summary">
        The default is a confirmed USDT0 approval on X Layer Testnet, so the explanation has a real
        user decision behind it. Each wallet receives one public verification request while bounded
        capacity remains. This path moves no funds and creates no voucher.
      </p>

      {!connected && state.status !== "connecting" && (
        <button
          className="button button-primary"
          onClick={() => {
            void connect();
          }}
          type="button"
        >
          <PlugZap aria-hidden="true" size={17} />
          Connect wallet to XMTP
        </button>
      )}

      {state.status === "connecting" && (
        <div className="live-xmtp-state" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="spin" size={18} />
          <span>Waiting for wallet and XMTP signatures</span>
        </div>
      )}

      {connected && (
        <form
          className="live-xmtp-form"
          onSubmit={(event) => {
            event.preventDefault();
            void request(transactionHash);
          }}
        >
          <label htmlFor="live-transaction-hash">X Layer Testnet transaction hash</label>
          <div className="live-xmtp-input-row">
            <input
              autoComplete="off"
              disabled={busy}
              id="live-transaction-hash"
              onChange={(event) => {
                setTransactionHash(event.target.value);
              }}
              spellCheck={false}
              type="text"
              value={transactionHash}
            />
            <button className="button button-primary" disabled={busy} type="submit">
              {busy ? (
                <LoaderCircle aria-hidden="true" className="spin" size={17} />
              ) : (
                <MessageSquareText aria-hidden="true" size={17} />
              )}
              {state.status === "sending"
                ? "Sending"
                : state.status === "waiting"
                  ? "Waiting for agent"
                  : "Request explanation"}
            </button>
          </div>
          <div className="live-xmtp-identity">
            <span>Buyer</span>
            <code>{shortHash(state.address)}</code>
            <span>Inbox</span>
            <code>{shortHash(state.inboxId)}</code>
            <button className="text-action" onClick={disconnect} type="button">
              Disconnect
            </button>
          </div>
        </form>
      )}

      {state.status === "waiting" && (
        <div className="live-xmtp-state" role="status" aria-live="polite">
          <LoaderCircle aria-hidden="true" className="spin" size={18} />
          <span>Request delivered. Synchronizing the signed seller response.</span>
        </div>
      )}

      {state.status === "error" && (
        <div className="live-xmtp-state live-xmtp-state-error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>{state.message}</span>
          <button
            className="text-action"
            onClick={
              state.code === "trial_wallet_used" || state.code === "trial_capacity_reached"
                ? disconnect
                : reset
            }
            type="button"
          >
            {state.code === "trial_wallet_used" || state.code === "trial_capacity_reached"
              ? "Close trial"
              : "Try again"}
          </button>
        </div>
      )}

      {state.status === "success" && (
        <article
          className="live-delivery live-delivery-compact"
          aria-label="Verified live XMTP delivery"
        >
          <div className="live-delivery-proof">
            <Check aria-hidden="true" size={16} />
            <span>
              The fresh signed request and delivery are now the active proof below. XMTP identity,
              envelope signatures, transaction binding, and result hash all passed.
            </span>
          </div>
          <button className="text-action" onClick={disconnect} type="button">
            <RotateCcw aria-hidden="true" size={15} />
            Trial complete · disconnect wallet
          </button>
        </article>
      )}
    </section>
  );
}
