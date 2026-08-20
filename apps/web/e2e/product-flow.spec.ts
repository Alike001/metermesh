import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("a judge can understand the promise and inspect accepted-work proof", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "AI work over messages, paid only when accepted." }),
  ).toBeVisible();
  await expect(page.getByText("OKX service authentication")).toBeVisible();

  await page.getByRole("button", { name: "Open metered session" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Explain an X Layer token approval before signing" }),
  ).toBeVisible();
  await expect(page.getByText("Captured local protocol run.")).toBeVisible();

  if (test.info().project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Proof rail" }).click();
  }

  await expect(page.getByTestId("amount-due")).toHaveText("0 USDT0");
  await page.getByRole("button", { name: "Accept local delivery" }).click();
  await expect(page.getByTestId("amount-due")).toHaveText("0.001 USDT0");
  await expect(page.getByRole("button", { name: "Settle on X Layer" })).toBeDisabled();

  await page.getByRole("button", { name: "Protocol details" }).click();
  await expect(page.getByRole("dialog", { name: "Where the evidence lives" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("the evidence export states that no funds moved", async ({ page }) => {
  await page.goto("/#workspace");
  await expect(page.getByText("Local delivery fixture")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence" }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const content = await readFile(downloadPath, "utf8");

  const evidence = JSON.parse(content) as {
    localReviewStatus: string;
    session: { capture: { fundsMoved: boolean; networkMode: string } };
  };
  expect(evidence.localReviewStatus).toBe("pending");
  expect(evidence.session.capture.fundsMoved).toBe(false);
  expect(evidence.session.capture.networkMode).toBe("offline");
});
