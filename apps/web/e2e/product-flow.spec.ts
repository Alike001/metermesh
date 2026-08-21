import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { verifyLiveEvidenceBundle } from "../src/domain/live-evidence";

test("a judge can understand the promise and inspect accepted-work proof", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("MeterMesh | Verify AI work on X Layer");
  await expect(
    page.getByRole("heading", { name: "AI work over messages. X Layer proves the result." }),
  ).toBeVisible();
  if (test.info().project.name === "mobile-chromium") {
    await expect(page.locator(".hero-copy h1 span")).toHaveCount(2);
    for (const line of await page.locator(".hero-copy h1 span").all()) {
      await expect(line).toHaveCSS("display", "block");
    }
  }
  await expect(page.getByText("X Layer receipt reads")).toBeVisible();

  await page.getByRole("button", { name: "Open live verifier" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Verified X Layer transaction explanation" }),
  ).toBeVisible();
  await expect(page.getByText("Published anchored proof.")).toBeVisible();
  await expect(page.getByText(/Every section below refers to request/i)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Request one real X Layer explanation" }),
  ).toBeVisible();
  await expect(page.getByText("Signed work request")).toBeVisible();
  await expect(page.getByText("Signed AI delivery")).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet to XMTP" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Install or open an EVM wallet extension before connecting to XMTP.",
  );

  if (test.info().project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Proof rail" }).click();
  }

  await expect(page.getByTestId("payment-state")).toHaveText("No voucher");
  await expect(page.getByRole("link", { name: "View anchor transaction" })).toHaveAttribute(
    "href",
    "https://web3.okx.com/explorer/x-layer-testnet/tx/0xf518187f13559ab46cfa1c85d64089a8c99eca8d1ee9d77a41840046f0e7aa5a",
  );
  await expect(page.getByRole("link", { name: "Inspect signed proof JSON" })).toHaveAttribute(
    "href",
    "/evidence/anchored-live-proof.json",
  );
  await expect(page.getByRole("link", { name: /Active X Layer transaction/i })).toHaveAttribute(
    "href",
    "https://web3.okx.com/explorer/x-layer-testnet/tx/0xf0bbcf38db1ee7935111b2be46fd1062d097e0461b2f48f34b9a5ba17482fafd",
  );
  await page.getByRole("button", { name: "Preview acceptance" }).click();
  await expect(page.getByTestId("payment-state")).toHaveText("No voucher");
  await expect(
    page.getByText(/marked this delivery useful.*No voucher was requested or signed/i),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Payment outside v1" })).toBeDisabled();

  await page.getByRole("button", { name: "Protocol details" }).click();
  await expect(page.getByRole("dialog", { name: "Where the evidence lives" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the active proof export passes the same verifier used by the workspace", async ({ page }) => {
  await page.goto("/#workspace");
  await expect(page.getByText("Published anchored proof.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export active proof" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const proof = JSON.parse(await readFile(downloadPath, "utf8")) as unknown;

  await expect(verifyLiveEvidenceBundle(proof)).resolves.toMatchObject({ ok: true });
});

test("the landing page links to the official MeterMesh X account", async ({ page }) => {
  await page.goto("/");

  const xLink = page.getByRole("link", { name: "@MeterMesh on X" });
  await expect(xLink).toHaveAttribute("href", "https://x.com/MeterMesh");
  await expect(xLink).toHaveAttribute("target", "_blank");
  await expect(page.getByRole("link", { name: "Inspect evidence" })).toHaveAttribute(
    "href",
    "/evidence/reverted-live-proof.json",
  );
  await expect(page.getByRole("link", { name: "view the receipt" })).toHaveAttribute(
    "href",
    "https://web3.okx.com/explorer/x-layer-testnet/tx/0x2a0f80f0297f4cb0944471015a5cd3dec9f031c4c4dfe335a2a4ba6a6d82b865",
  );
});

test("the offline fixture download cannot be mistaken for signed payment proof", async ({
  page,
}) => {
  await page.goto("/#workspace");
  await expect(page.getByRole("button", { name: "Offline fallback" })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Offline fallback" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const content = await readFile(downloadPath, "utf8");

  const evidence = JSON.parse(content) as {
    capture: { fundsMoved: boolean; kind: string; networkMode: string };
  };
  expect(evidence.capture.kind).toBe("local-protocol-verification");
  expect(evidence.capture.fundsMoved).toBe(false);
  expect(evidence.capture.networkMode).toBe("offline");
});
