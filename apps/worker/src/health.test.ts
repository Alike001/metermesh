import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { closeHealthServer, startHealthServer, WorkerHealth } from "./health.js";

const servers: Awaited<ReturnType<typeof startHealthServer>>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => closeHealthServer(server)));
});

describe("worker health", () => {
  it("stays unhealthy until setup and a recent cycle succeed", async () => {
    let now = Date.parse("2026-08-20T12:00:00.000Z");
    const health = new WorkerHealth(5_000, () => now);
    const server = await startHealthServer(0, health);
    servers.push(server);
    const address = server.address() as AddressInfo;
    const url = `http://127.0.0.1:${String(address.port)}/health`;

    await expect(fetch(url).then((response) => response.status)).resolves.toBe(503);
    health.markCycleSucceeded();
    await expect(fetch(url).then((response) => response.status)).resolves.toBe(200);
    now += 5_001;
    await expect(fetch(url).then((response) => response.status)).resolves.toBe(503);
    health.markStopped();
    await expect(fetch(url).then((response) => response.status)).resolves.toBe(503);
  });
});
