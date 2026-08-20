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
import { liveExplanation, useLiveXmtp } from "../hooks/useLiveXmtp";
import { StatusMark } from "./StatusMark";

const exampleTransactionHash = "0xafe21e8d40d641bec6bba559ed40a2289689cab89d306f67c99e0ee38873973f";

export function LiveXmtpPanel() {
  const [transactionHash, setTransactionHash] = useState(exampleTransactionHash);
  const { connect, disconnect, request, reset, state } = useLiveXmtp();
  const explanation = liveExplanation(state);
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
          label={connected ? "XMTP connected" : "No payment"}
          status={connected ? "verified" : "pending"}
        />
      </div>
      <p className="live-xmtp-summary">
        Your wallet signs the XMTP identity and request. This path moves no funds and creates no
        voucher while OKX MPP Testnet mutation remains gated.
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
          <button className="text-action" onClick={reset} type="button">
            Try again
          </button>
        </div>
      )}

      {state.status === "success" && explanation !== null && (
        <article className="live-delivery" aria-label="Verified live XMTP delivery">
          <div className="live-delivery-title">
            <div>
              <span className="message-label">Agent delivery</span>
              <h3>{explanation.summary}</h3>
            </div>
            <StatusMark label="Verified live" status="verified" />
          </div>
          <p>{explanation.outcome}</p>
          <dl>
            <div>
              <dt>Transaction</dt>
              <dd>{shortHash(explanation.transactionHash)}</dd>
            </div>
            <div>
              <dt>Block</dt>
              <dd>{explanation.provenance.blockNumber}</dd>
            </div>
            <div>
              <dt>Confirmations</dt>
              <dd>{explanation.provenance.confirmations}</dd>
            </div>
            <div>
              <dt>Result hash</dt>
              <dd>{shortHash(state.delivery.envelope.payload.resultHash)}</dd>
            </div>
          </dl>
          <div className="live-delivery-proof">
            <Check aria-hidden="true" size={16} />
            XMTP sender, signer authorization, envelope signature, transaction reference, schema,
            and result hash all passed.
          </div>
          <button className="text-action" onClick={reset} type="button">
            <RotateCcw aria-hidden="true" size={15} />
            Request another explanation
          </button>
        </article>
      )}
    </section>
  );
}
