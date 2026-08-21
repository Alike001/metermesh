import { readFile, writeFile } from "node:fs/promises";

import { explainTransaction } from "@metermesh/ai";
import { fetchTransactionFacts } from "@metermesh/chain";
import { getMeterMeshXmtpConfig, NodeXmtpCarrier } from "@metermesh/xmtp";
import { expect, test, type Page } from "@playwright/test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { MeterMeshTransportWorker } from "../../worker/src/orchestrator";
import { verifyLiveEvidenceBundle } from "../src/domain/live-evidence";
import { LiveMemoryOutbox } from "./helpers/memory-outbox";

declare global {
  interface Window {
    meterMeshWalletRequest: (method: string, parameters: unknown[] | undefined) => Promise<unknown>;
  }
}

function parseEnvironment(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

function isExpectedXmtpCancellation(failure: string): boolean {
  return failure.includes("https://api.dev.xmtp.network:") && failure.endsWith("net::ERR_ABORTED");
}

async function waitForXmtpConnection(page: Page): Promise<void> {
  const livePanel = page.locator(".live-xmtp-panel");
  const connected = livePanel.getByText("XMTP connected");
  const failure = livePanel.getByRole("alert");
  const outcome = await Promise.race([
    connected.waitFor({ state: "visible", timeout: 190_000 }).then(() => "connected" as const),
    failure.waitFor({ state: "visible", timeout: 190_000 }).then(() => "failed" as const),
  ]);
  if (outcome === "failed") {
    throw new Error(`XMTP connection failed: ${(await failure.textContent()) ?? "unknown error"}`);
  }
}

async function loadLocalServerEnvironment(): Promise<void> {
  const values = parseEnvironment(await readFile("../../.env.local", "utf8"));
  for (const name of [
    "GROQ_API_KEY",
    "GROQ_MODEL",
    "XMTP_APP_VERSION",
    "XMTP_DB_ENCRYPTION_KEY",
    "XMTP_DB_PATH",
    "XMTP_ENV",
    "XMTP_WALLET_KEY",
    "X_LAYER_RPC_URL",
  ]) {
    const value = values[name];
    if (value !== undefined && process.env[name] === undefined) process.env[name] = value;
  }
}

test("a real injected buyer wallet receives one verified worker delivery", async ({
  page,
}, testInfo) => {
  test.setTimeout(480_000);
  test.skip(
    process.env.METERMESH_LIVE_BROWSER_XMTP !== "1",
    "Set METERMESH_LIVE_BROWSER_XMTP=1 to run the live network proof.",
  );
  test.skip(testInfo.project.name !== "desktop-chromium", "The live proof runs once on desktop.");
  const useRemoteWorker = process.env.METERMESH_REMOTE_XMTP_WORKER === "1";
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  let carrier: NodeXmtpCarrier | null = null;
  let worker: MeterMeshTransportWorker | null = null;
  if (!useRemoteWorker) {
    await loadLocalServerEnvironment();
    const xmtpConfig = getMeterMeshXmtpConfig();
    carrier = await NodeXmtpCarrier.connect(xmtpConfig);
    let trialUsed = false;
    worker = new MeterMeshTransportWorker({
      authorizeRequest: (request) => {
        if (request.signature.signer.toLowerCase() !== buyerAccount.address.toLowerCase()) {
          return Promise.resolve({
            detail: "Historical request from another live-test wallet.",
            ok: false as const,
            silent: true as const,
          });
        }
        if (trialUsed) {
          return Promise.resolve({
            code: "trial_wallet_used" as const,
            detail: "This wallet has already used its one public verification request.",
            ok: false as const,
            retryable: false,
            silent: false as const,
          });
        }
        trialUsed = true;
        return Promise.resolve({ ok: true as const });
      },
      carrier,
      explain: async (transactionHash) =>
        explainTransaction(await fetchTransactionFacts(transactionHash)),
      outbox: new LiveMemoryOutbox(),
      sellerWalletKey: xmtpConfig.walletKey,
      workerId: "live-browser-worker",
    });
  }

  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("requestfailed", (request) => {
    failedRequests.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
    );
  });
  await page.exposeFunction(
    "meterMeshWalletRequest",
    async (method: string, parameters: unknown[] | undefined): Promise<unknown> => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") {
        return [buyerAccount.address];
      }
      if (method === "personal_sign") {
        const message = parameters?.[0];
        if (typeof message !== "string") throw new Error("personal_sign message is missing.");
        return buyerAccount.signMessage({
          message: message.startsWith("0x") ? { raw: message as `0x${string}` } : message,
        });
      }
      throw new Error(`Unsupported test wallet method: ${method}`);
    },
  );
  await page.addInitScript(
    ({ address }) => {
      const walletRequest = window.meterMeshWalletRequest;
      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: {
          on: () => undefined,
          removeListener: () => undefined,
          request: (input: { method: string; params?: unknown[] }) =>
            walletRequest(input.method, input.params),
          selectedAddress: address,
        },
      });
    },
    { address: buyerAccount.address },
  );

  try {
    await page.goto("/#workspace");
    await expect(
      page.getByRole("heading", { name: "Verified X Layer transaction explanation" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Connect wallet to XMTP" }).click();
    await waitForXmtpConnection(page);
    const transactionHash =
      process.env.X_LAYER_TEST_TRANSACTION_HASH?.trim() ??
      "0xf0bbcf38db1ee7935111b2be46fd1062d097e0461b2f48f34b9a5ba17482fafd";
    await page.getByLabel("X Layer Testnet transaction hash").fill(transactionHash);
    await page.getByRole("button", { name: "Request explanation" }).click();
    await expect(page.getByRole("button", { name: "Waiting for agent" })).toBeVisible({
      timeout: 60_000,
    });
    if (worker !== null) {
      let queued = 0;
      for (let attempt = 0; attempt < 10 && queued === 0; attempt += 1) {
        queued = (await worker.ingest()).queued;
        if (queued === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      expect(queued).toBeGreaterThan(0);
      await worker.processAvailable();
      await worker.processAvailable();
    }
    await expect(page.getByText("Verified live").first()).toBeVisible({ timeout: 120_000 });
    await expect(page.getByLabel("Verified live XMTP delivery")).toContainText(
      "XMTP identity, envelope signatures, transaction binding",
    );
    await expect(page.getByRole("heading", { name: "X Layer receipt" })).toBeVisible();
    await expect(page.getByTestId("payment-state")).toHaveText("No voucher");

    const proofDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export active proof" }).click();
    const proofDownload = await proofDownloadPromise;
    const proofPath = await proofDownload.path();
    const proof = JSON.parse(await readFile(proofPath, "utf8")) as unknown;
    await expect(verifyLiveEvidenceBundle(proof)).resolves.toMatchObject({ ok: true });
    expect(proof).toMatchObject({
      chainId: 1952,
      fundsMoved: false,
      kind: "live-nonbillable-verification",
      voucherSigned: false,
    });
    const proofOutput = process.env.METERMESH_LIVE_PROOF_OUTPUT?.trim();
    if (proofOutput !== undefined && proofOutput !== "") {
      await writeFile(proofOutput, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
    }
    const successScreenshot = process.env.METERMESH_PUBLIC_PROOF_SCREENSHOT?.trim();
    if (successScreenshot !== undefined && successScreenshot !== "") {
      await page.screenshot({ fullPage: true, path: successScreenshot });
    }
    await page.getByRole("button", { name: /trial complete/i }).click();
    await page.getByRole("button", { name: "Connect wallet to XMTP" }).click();
    await waitForXmtpConnection(page);
    await page.getByRole("button", { name: "Request explanation" }).click();
    await expect(page.getByRole("button", { name: "Waiting for agent" })).toBeVisible({
      timeout: 60_000,
    });
    if (worker !== null) {
      let rejected = 0;
      for (let attempt = 0; attempt < 10 && rejected === 0; attempt += 1) {
        rejected = (await worker.ingest()).rejected;
        if (rejected === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
      expect(rejected).toBeGreaterThan(0);
      await worker.processAvailable();
    }
    await expect(
      page.getByText("This wallet has already used its one public verification request."),
    ).toBeVisible({ timeout: 120_000 });
    const refusalScreenshot = process.env.METERMESH_PUBLIC_REFUSAL_SCREENSHOT?.trim();
    if (refusalScreenshot !== undefined && refusalScreenshot !== "") {
      await page.screenshot({ fullPage: true, path: refusalScreenshot });
    }
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedRequests.filter((failure) => !isExpectedXmtpCancellation(failure))).toEqual([]);
  } finally {
    if (carrier !== null) await carrier.close();
  }
});
