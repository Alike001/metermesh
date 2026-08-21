import { useCallback, useEffect, useRef, useState } from "react";
import type { TransactionExplanation } from "@metermesh/ai";

import type {
  BrowserXmtpConnection,
  BrowserXmtpFailureCode,
  ReceivedBrowserDelivery,
  SentBrowserRequest,
} from "../services/browser-xmtp";

export type LiveXmtpState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { address: `0x${string}`; inboxId: string; status: "ready" }
  | { address: `0x${string}`; inboxId: string; status: "sending" }
  | {
      address: `0x${string}`;
      inboxId: string;
      request: SentBrowserRequest;
      status: "waiting";
    }
  | {
      address: `0x${string}`;
      delivery: ReceivedBrowserDelivery;
      inboxId: string;
      request: SentBrowserRequest;
      status: "success";
    }
  | {
      code: BrowserXmtpFailureCode;
      message: string;
      status: "error";
    };

export interface LiveXmtpController {
  connect: () => Promise<void>;
  disconnect: () => void;
  request: (transactionHash: string) => Promise<void>;
  reset: () => void;
  state: LiveXmtpState;
}

function failureFor(
  error: unknown,
  fallbackCode: BrowserXmtpFailureCode,
  fallbackMessage: string,
): { code: BrowserXmtpFailureCode; message: string } {
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    [
      "delivery_timeout",
      "invalid_sequence",
      "invalid_request",
      "request_denied",
      "trial_capacity_reached",
      "trial_wallet_used",
      "wallet_missing",
      "wallet_rejected",
      "work_failed",
      "xmtp_connect_failed",
      "xmtp_send_failed",
    ].includes(error.code)
  ) {
    return { code: error.code as BrowserXmtpFailureCode, message: error.message };
  }
  return { code: fallbackCode, message: fallbackMessage };
}

export function useLiveXmtp(): LiveXmtpController {
  const connectionRef = useRef<BrowserXmtpConnection | null>(null);
  const [state, setState] = useState<LiveXmtpState>({ status: "disconnected" });

  const disconnect = useCallback(() => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setState({ status: "disconnected" });
  }, []);

  useEffect(
    () => () => {
      connectionRef.current?.close();
      connectionRef.current = null;
    },
    [],
  );

  const connect = useCallback(async () => {
    connectionRef.current?.close();
    connectionRef.current = null;
    setState({ status: "connecting" });
    try {
      const { createBrowserXmtpConnection } = await import("../services/browser-xmtp");
      const connection = await createBrowserXmtpConnection();
      connectionRef.current = connection;
      setState({ address: connection.address, inboxId: connection.inboxId, status: "ready" });
    } catch (error) {
      const failure = failureFor(error, "xmtp_connect_failed", "XMTP could not connect.");
      setState({ code: failure.code, message: failure.message, status: "error" });
    }
  }, []);

  const request = useCallback(async (transactionHash: string) => {
    const connection = connectionRef.current;
    if (connection === null) {
      setState({
        code: "xmtp_connect_failed",
        message: "Connect the buyer wallet before sending a request.",
        status: "error",
      });
      return;
    }
    setState({ address: connection.address, inboxId: connection.inboxId, status: "sending" });
    try {
      const sentRequest = await connection.sendRequest(transactionHash);
      setState({
        address: connection.address,
        inboxId: connection.inboxId,
        request: sentRequest,
        status: "waiting",
      });
      const delivery = await connection.waitForDelivery(sentRequest);
      setState({
        address: connection.address,
        delivery,
        inboxId: connection.inboxId,
        request: sentRequest,
        status: "success",
      });
    } catch (error) {
      const failure = failureFor(error, "xmtp_send_failed", "The live request did not complete.");
      setState({ code: failure.code, message: failure.message, status: "error" });
    }
  }, []);

  const reset = useCallback(() => {
    const connection = connectionRef.current;
    setState(
      connection === null
        ? { status: "disconnected" }
        : { address: connection.address, inboxId: connection.inboxId, status: "ready" },
    );
  }, []);

  return { connect, disconnect, request, reset, state };
}

export function liveExplanation(state: LiveXmtpState): TransactionExplanation | null {
  return state.status === "success" ? state.delivery.result : null;
}
