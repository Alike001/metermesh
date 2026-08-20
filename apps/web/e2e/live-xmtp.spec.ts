import { readFile } from "node:fs/promises";

import { explainTransaction } from "@metermesh/ai";
import { fetchTransactionFacts } from "@metermesh/chain";
import { getMeterMeshXmtpConfig, NodeXmtpCarrier } from "@metermesh/xmtp";
import { expect, test } from "@playwright/test";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import { MeterMeshTransportWorker } from "../../worker/src/orchestrator";
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
  test.setTimeout(180_000);
  test.skip(
    process.env.METERMESH_LIVE_BROWSER_XMTP !== "1",
    "Set METERMESH_LIVE_BROWSER_XMTP=1 to run the live network proof.",
  );
  test.skip(testInfo.project.name !== "desktop-chromium", "The live proof runs once on desktop.");
  await loadLocalServerEnvironment();
  const buyerAccount = privateKeyToAccount(generatePrivateKey());
  const xmtpConfig = getMeterMeshXmtpConfig();
  const carrier = await NodeXmtpCarrier.connect(xmtpConfig);
  const worker = new MeterMeshTransportWorker({
    allowedBuyerAddress: buyerAccount.address,
    carrier,
    explain: async (transactionHash) =>
      explainTransaction(await fetchTransactionFacts(transactionHash)),
    outbox: new LiveMemoryOutbox(),
    sellerWalletKey: xmtpConfig.walletKey,
    workerId: "live-browser-worker",
  });

  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
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
    await page.getByRole("button", { name: "Connect wallet to XMTP" }).click();
    await expect(page.getByText("XMTP connected")).toBeVisible({ timeout: 90_000 });
    await page.getByRole("button", { name: "Request explanation" }).click();
    await expect(page.getByRole("button", { name: "Waiting for agent" })).toBeVisible({
      timeout: 60_000,
    });
    let queued = 0;
    for (let attempt = 0; attempt < 10 && queued === 0; attempt += 1) {
      queued = (await worker.ingest()).queued;
      if (queued === 0) await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    expect(queued).toBeGreaterThan(0);
    await worker.processAvailable();
    await worker.processAvailable();
    await expect(page.getByText("Verified live")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByLabel("Verified live XMTP delivery")).toContainText(
      "XMTP sender, signer authorization, envelope signature",
    );
    expect(consoleErrors).toEqual([]);
  } finally {
    await carrier.close();
  }
});
