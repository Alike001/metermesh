/** @vitest-environment jsdom */
import "./test/setup";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import capturedSession from "../public/evidence/captured-session.json";
import App from "./App";

function successfulEvidenceResponse() {
  return Promise.resolve(
    new Response(JSON.stringify(capturedSession), {
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
      screen.getByRole("heading", { name: "AI work over messages, paid only when accepted." }),
    ).toBeInTheDocument();

    const [openButton] = screen.getAllByRole("button", { name: /open metered session/i });
    expect(openButton).toBeDefined();
    if (openButton === undefined) throw new Error("The landing CTA is missing.");
    await user.click(openButton);

    expect(
      await screen.findByRole("heading", {
        name: "Explain an X Layer token approval before signing",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Captured local protocol run.")).toBeInTheDocument();
  });

  it("records an honest local acceptance without enabling settlement", async () => {
    const user = userEvent.setup();
    window.location.hash = "workspace";
    render(<App />);

    await screen.findByText("Local delivery fixture");
    expect(screen.getByTestId("amount-due")).toHaveTextContent("0 USDT0");

    await user.click(screen.getByRole("button", { name: "Accept local delivery" }));

    expect(screen.getByTestId("amount-due")).toHaveTextContent("0.001 USDT0");
    expect(
      screen.getByText("One local unit is marked accepted. No voucher has been signed."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settle on X Layer" })).toBeDisabled();
  });

  it("fails safely when a live XMTP request has no injected wallet", async () => {
    window.location.hash = "workspace";
    render(<App />);
    await screen.findByText("Local delivery fixture");

    await userEvent.click(screen.getByRole("button", { name: "Connect wallet to XMTP" }));

    expect(await screen.findByRole("alert", undefined, { timeout: 10_000 })).toHaveTextContent(
      "Install or open an EVM wallet extension before connecting to XMTP.",
    );
    expect(screen.getByRole("button", { name: "Settle on X Layer" })).toBeDisabled();
  });

  it("supports the empty state and restores captured evidence", async () => {
    const user = userEvent.setup();
    window.location.hash = "workspace";
    render(<App />);

    await screen.findByText("Local delivery fixture");
    await user.click(screen.getByRole("button", { name: "Remove captured evidence" }));

    expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    const [loadButton] = screen.getAllByRole("button", { name: "Load captured run" });
    expect(loadButton).toBeDefined();
    if (loadButton === undefined) throw new Error("The evidence restore action is missing.");
    await user.click(loadButton);
    expect(await screen.findByText("Local delivery fixture")).toBeInTheDocument();
  });

  it("shows a retryable error when evidence cannot be read", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Local evidence unavailable."));
    window.location.hash = "workspace";
    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Local evidence unavailable.");
    vi.mocked(fetch).mockImplementation(successfulEvidenceResponse);

    await userEvent.click(screen.getByRole("button", { name: "Retry evidence load" }));
    expect(await screen.findByText("Local delivery fixture")).toBeInTheDocument();
  });

  it("opens protocol details and closes them with Escape", async () => {
    const user = userEvent.setup();
    window.location.hash = "workspace";
    render(<App />);
    await screen.findByText("Local delivery fixture");

    await user.click(screen.getByRole("button", { name: "Protocol details" }));
    expect(screen.getByRole("dialog", { name: "Where the evidence lives" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
