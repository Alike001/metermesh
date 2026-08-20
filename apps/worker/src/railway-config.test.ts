import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";
import { z } from "zod";

const railwayConfigSchema = z.strictObject({
  $schema: z.literal("https://railway.com/railway.schema.json"),
  build: z.strictObject({
    builder: z.literal("RAILPACK"),
    buildCommand: z.string().min(1),
    watchPatterns: z.array(z.string().startsWith("/")).min(1),
  }),
  deploy: z.strictObject({
    healthcheckPath: z.string().startsWith("/"),
    healthcheckTimeout: z.number().int().positive(),
    restartPolicyMaxRetries: z.number().int().positive(),
    restartPolicyType: z.literal("ON_FAILURE"),
    startCommand: z.string().min(1),
  }),
});

async function readConfig(name: string) {
  const input = JSON.parse(
    await readFile(new URL(`../../../deploy/${name}`, import.meta.url), "utf8"),
  ) as unknown;
  return railwayConfigSchema.parse(input);
}

async function readWebPackage(): Promise<{ scripts: { start: string } }> {
  const input = JSON.parse(
    await readFile(new URL("../../web/package.json", import.meta.url), "utf8"),
  ) as { scripts: { start: string } };
  return input;
}

async function readRailwayIgnore(): Promise<string> {
  return readFile(new URL("../../../.railwayignore", import.meta.url), "utf8");
}

describe("Railway service configuration", () => {
  it("keeps the public web and private worker commands explicit", async () => {
    const [web, worker, webPackage, railwayIgnore] = await Promise.all([
      readConfig("railway.web.json"),
      readConfig("railway.worker.json"),
      readWebPackage(),
      readRailwayIgnore(),
    ]);

    expect(web).toMatchObject({
      build: { buildCommand: "pnpm --filter @metermesh/web... build" },
      deploy: {
        healthcheckPath: "/",
        startCommand: "pnpm --filter @metermesh/web start",
      },
    });
    expect(worker).toMatchObject({
      build: { buildCommand: "pnpm --filter @metermesh/worker... build" },
      deploy: {
        healthcheckPath: "/health",
        startCommand: "pnpm --filter @metermesh/worker start",
      },
    });
    expect(web.build.watchPatterns).toContain("/apps/web/**");
    expect(web.build.watchPatterns).toContain("/deploy/railway.web.json");
    expect(worker.build.watchPatterns).toContain("/apps/worker/**");
    expect(worker.build.watchPatterns).toContain("/deploy/railway.worker.json");
    expect(worker.build.watchPatterns).toContain("/packages/db/**");
    expect(webPackage.scripts.start).toBe("serve --no-clipboard --listen $PORT dist");
    expect(webPackage.scripts.start).not.toContain("--single");
    for (const excluded of [".env.*", ".xmtp/", "AGENTS.md", "handoff.md", "log.md"]) {
      expect(railwayIgnore.split("\n")).toContain(excluded);
    }
  });
});
