import { createServer, type Server } from "node:http";

export class WorkerHealth {
  #lastCycleAt: number | null = null;
  #ready = false;

  constructor(
    readonly maximumStalenessMs: number,
    readonly now: () => number = Date.now,
  ) {}

  markCycleSucceeded(): void {
    this.#lastCycleAt = this.now();
    this.#ready = true;
  }

  markStopped(): void {
    this.#ready = false;
  }

  snapshot(): { lastCycleAt: string | null; status: "ready" | "stale" | "starting" | "stopped" } {
    if (!this.#ready) {
      return {
        lastCycleAt: this.#lastCycleAt === null ? null : new Date(this.#lastCycleAt).toISOString(),
        status: this.#lastCycleAt === null ? "starting" : "stopped",
      };
    }
    const stale =
      this.#lastCycleAt === null || this.now() - this.#lastCycleAt > this.maximumStalenessMs;
    return {
      lastCycleAt: this.#lastCycleAt === null ? null : new Date(this.#lastCycleAt).toISOString(),
      status: stale ? "stale" : "ready",
    };
  }
}

export async function startHealthServer(port: number, health: WorkerHealth): Promise<Server> {
  const server = createServer((request, response) => {
    if ((request.method !== "GET" && request.method !== "HEAD") || request.url !== "/health") {
      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ status: "not_found" }));
      return;
    }
    const snapshot = health.snapshot();
    const ready = snapshot.status === "ready";
    response.writeHead(ready ? 200 : 503, {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    });
    response.end(request.method === "HEAD" ? undefined : JSON.stringify(snapshot));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", () => {
      server.off("error", reject);
      resolve();
    });
  });
  return server;
}

export async function closeHealthServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
}
