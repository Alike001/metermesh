import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const xmtpWasmAsset = /^assets\/bindings_wasm_bg-[A-Za-z0-9_-]+\.wasm$/u;

export const XMTP_BROWSER_WASM_CDN_URL =
  "https://cdn.jsdelivr.net/npm/@xmtp/wasm-bindings@1.11.0/dist/bindings_wasm_bg.wasm";

export function renderMeterMeshBuiltUrl(filename: string): string | undefined {
  return xmtpWasmAsset.test(filename) ? XMTP_BROWSER_WASM_CDN_URL : undefined;
}

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        docs: resolve(import.meta.dirname, "docs/index.html"),
        main: resolve(import.meta.dirname, "index.html"),
      },
    },
    sourcemap: true,
  },
  experimental: {
    renderBuiltUrl: renderMeterMeshBuiltUrl,
  },
  plugins: [react()],
});
