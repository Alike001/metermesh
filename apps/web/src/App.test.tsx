/** @vitest-environment jsdom */
import "./test/setup";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import anchoredLiveProof from "../public/evidence/anchored-live-proof.json";
import capturedSession from "../public/evidence/captured-session.json";
import App from "./App";

function successfulEvidenceResponse(input?: RequestInfo | URL) {
  const url = input instanceof Request ? input.url : String(input ?? "");
  const value = url.includes("anchored-live-proof") ? anchoredLiveProof : capturedSession;
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

describe("MeterMesh product surface", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/");
    vi.stubGlobal("fetch", vi.fn(successfulEvidenceResponse));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("states the product promise and opens the workspace", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "AI work over messages. X Layer proves the result.",
      }),
    ).toBeInTheDocument();

    const [openButton] = screen.getAllByRole("button", { name: /open live verifier/i });
    expect(openButton).toBeDefined();
    if (openButton === undefined) throw new Error("The landing CTA is missing.");
    await user.click(openButton);

    expect(
      await screen.findByRole("heading", {
        name: "Verified X Layer transaction explanation",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Published anchored proof.")).toBeInTheDocument();
    expect(screen.getByText(/XMTP transport.*are working/i)).toBeInTheDocument();
  });

  it("previews the acceptance rule without creating payment evidence", async () => {
    const user = userEvent.setup();
    window.location.hash = "workspace";
    render(<App />);

    await screen.findByText("Published anchored proof.");
    expect(screen.getByTestId("payment-state")).toHaveTextContent("No voucher");

    await user.click(screen.getByRole("button", { name: "Preview acceptance" }));

    expect(screen.getByTestId("payment-state")).toHaveTextContent("No voucher");
    expect(
      screen.getByText(
        "The buyer marked this delivery useful in an unsigned preview. No voucher was requested or signed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Payment outside v1" })).toBeDisabled();
  });

  it("fails safely when a live XMTP request has no injected wallet", async () => {
    window.location.hash = "workspace";
    render(<App />);
    await screen.findByText("Published anchored proof.");

    await userEvent.click(screen.getByRole("button", { name: "Connect wallet to XMTP" }));

    expect(await screen.findByRole("alert", undefined, { timeout: 10_000 })).toHaveTextContent(
      "Install or open an EVM wallet extension before connecting to XMTP.",
    );
    expect(screen.getByRole("button", { name: "Payment outside v1" })).toBeDisabled();
  });

  it("shows a retryable error when the signed proof cannot be read", async () => {
    let anchoredAttempts = 0;
    vi.mocked(fetch).mockImplementation((input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("anchored-live-proof") && anchoredAttempts === 0) {
        anchoredAttempts += 1;
        return Promise.reject(new Error("Signed proof unavailable."));
      }
      return successfulEvidenceResponse(input);
    });
    window.location.hash = "workspace";
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Signed proof unavailable.");
    vi.mocked(fetch).mockImplementation(successfulEvidenceResponse);

    await userEvent.click(screen.getByRole("button", { name: "Retry proof verification" }));
    expect(await screen.findByText("Published anchored proof.")).toBeInTheDocument();
  });

  it("opens protocol details and closes them with Escape", async () => {
    const user = userEvent.setup();
    window.location.hash = "workspace";
    render(<App />);
    await screen.findByText("Published anchored proof.");

    await user.click(screen.getByRole("button", { name: "Protocol details" }));
    expect(screen.getByRole("dialog", { name: "Where the evidence lives" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
