import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

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
  plugins: [react()],
});
