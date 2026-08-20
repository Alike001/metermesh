import { expect, test } from "@playwright/test";

test("a developer can understand the integration boundary and inspect machine artifacts", async ({
  page,
}) => {
  await page.goto("/docs/");

  await expect(
    page.getByRole("heading", { name: "One accepted result advances the meter." }),
  ).toBeVisible();
  await expect(page.getByText("Fixed amount per accepted delivery")).toBeVisible();
  await expect(page.getByText("AI never signs a buyer voucher.")).toBeVisible();
  await expect(page.getByText("XMTP browser and worker")).toBeVisible();
  await expect(
    page.getByText(/fresh injected browser wallet sent a signed XMTP dev request/i),
  ).toBeVisible();
  await expect(page.getByText("OKX MPP Testnet mutation")).toBeVisible();
  await expect(page.getByText("gated", { exact: true })).toBeVisible();

  const manifestResponse = await page.request.get("/.well-known/metermesh.json");
  expect(manifestResponse.ok()).toBe(true);
  const openApiResponse = await page.request.get("/openapi.json");
  expect(openApiResponse.ok()).toBe(true);
  const llmsResponse = await page.request.get("/llms.txt");
  expect(llmsResponse.ok()).toBe(true);

  await expect(page.getByRole("link", { name: "MeterMesh product home" })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.getByRole("link", { name: /source/i }).first()).toHaveAttribute(
    "href",
    "https://github.com/Alike001/metermesh",
  );

  await page.getByRole("link", { name: "Machine access" }).click();
  await expect(page.locator("#machine")).toBeInViewport();
});

test("the request example copies and the page stays usable by keyboard", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/docs/");

  await page.getByRole("button", { name: "Copy request" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(JSON.parse(clipboard)).toMatchObject({
    protocol: "metermesh",
    type: "work.request",
    version: 1,
  });

  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
});
