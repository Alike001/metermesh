import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@metermesh/chain": fileURLToPath(new URL("./packages/chain/src/index.ts", import.meta.url)),
      "@metermesh/protocol": fileURLToPath(
        new URL("./packages/protocol/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      exclude: ["**/*.config.{js,mjs,ts}", "**/*.d.ts"],
      include: ["apps/**/src/**/*.{ts,tsx}", "packages/**/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    restoreMocks: true,
    testTimeout: 15_000,
  },
});
