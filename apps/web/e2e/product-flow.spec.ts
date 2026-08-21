import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
    page.getByRole("heading", { name: "Explain an X Layer token approval before signing" }),
  ).toBeVisible();
  await expect(page.getByText("Captured local protocol run.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Request one real X Layer explanation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet to XMTP" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Install or open an EVM wallet extension before connecting to XMTP.",
  );

  if (test.info().project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Proof rail" }).click();
  }

  await expect(page.getByTestId("payment-state")).toHaveText("No voucher");
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

test("the landing page links to the official MeterMesh X account", async ({ page }) => {
  await page.goto("/");

  const xLink = page.getByRole("link", { name: "@MeterMesh on X" });
  await expect(xLink).toHaveAttribute("href", "https://x.com/MeterMesh");
  await expect(xLink).toHaveAttribute("target", "_blank");
});

test("the offline fixture download cannot be mistaken for signed payment proof", async ({
  page,
}) => {
  await page.goto("/#workspace");
  await expect(page.getByText("Local delivery fixture")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download offline fixture" }).click();
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
