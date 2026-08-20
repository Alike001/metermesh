import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { renderMeterMeshBuiltUrl, XMTP_BROWSER_WASM_CDN_URL } from "./vite.config";

describe("MeterMesh production asset routing", () => {
  it("pins only the emitted XMTP WASM to the matching immutable package version", async () => {
    const browserSdk = JSON.parse(
      await readFile(
        new URL("./node_modules/@xmtp/browser-sdk/package.json", import.meta.url),
        "utf8",
      ),
    ) as { dependencies: Record<string, string> };
    const wasmVersion = browserSdk.dependencies["@xmtp/wasm-bindings"];

    expect(wasmVersion).toBe("1.11.0");
    if (wasmVersion === undefined) throw new Error("The browser SDK has no WASM dependency.");
    expect(XMTP_BROWSER_WASM_CDN_URL).toContain(`@xmtp/wasm-bindings@${wasmVersion}/`);
    expect(renderMeterMeshBuiltUrl("assets/bindings_wasm_bg-DwF1mzFa.wasm")).toBe(
      XMTP_BROWSER_WASM_CDN_URL,
    );
    expect(renderMeterMeshBuiltUrl("assets/main-example.js")).toBeUndefined();
    expect(renderMeterMeshBuiltUrl("openapi.json")).toBeUndefined();
  });
});
