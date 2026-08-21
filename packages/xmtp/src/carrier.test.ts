import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isRetryableXmtpError,
  secureXmtpDatabasePath,
  withXmtpRetry,
  XmtpRetryExhaustedError,
} from "./carrier.js";

describe("XMTP local storage permissions", () => {
  it("limits the database, salt, journal files, and directory to the current user", async () => {
    const directory = await mkdtemp(join(tmpdir(), "metermesh-xmtp-permissions-"));
    const dbPath = join(directory, "seller.db3");
    await Promise.all(
      [dbPath, `${dbPath}-shm`, `${dbPath}-wal`, `${dbPath}.sqlcipher_salt`].map((path) =>
        writeFile(path, "fixture", { mode: 0o644 }),
      ),
    );

    await secureXmtpDatabasePath(dbPath);

    expect((await stat(directory)).mode & 0o777).toBe(0o700);
    for (const path of [dbPath, `${dbPath}-shm`, `${dbPath}-wal`, `${dbPath}.sqlcipher_salt`]) {
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
  });
});

describe("XMTP sync retry boundary", () => {
  it("backs off transient resource exhaustion and returns after recovery", async () => {
    let attempts = 0;
    const delays: number[] = [];

    await expect(
      withXmtpRetry(
        () => {
          attempts += 1;
          if (attempts < 3) return Promise.reject(new Error("Some resource has been exhausted"));
          return Promise.resolve("synced");
        },
        {
          delayMs: 10,
          sleep: (durationMs) =>
            Promise.resolve().then(() => {
              delays.push(durationMs);
            }),
        },
      ),
    ).resolves.toBe("synced");
    expect(attempts).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("keeps non-transient errors fail-fast", async () => {
    let attempts = 0;

    await expect(
      withXmtpRetry(
        () => {
          attempts += 1;
          return Promise.reject(new Error("Invalid XMTP database key"));
        },
        { delayMs: 0 },
      ),
    ).rejects.toThrow("Invalid XMTP database key");
    expect(attempts).toBe(1);
    expect(isRetryableXmtpError(new Error("Invalid XMTP database key"))).toBe(false);
  });

  it("reports exhausted rate limits without hiding the original cause", async () => {
    const original = new Error("429 rate limit exceeded");
    const failure = withXmtpRetry(() => Promise.reject(original), {
      attempts: 3,
      delayMs: 0,
      sleep: () => Promise.resolve(),
    });

    await expect(failure).rejects.toBeInstanceOf(XmtpRetryExhaustedError);
    await expect(failure).rejects.toMatchObject({ attempts: 3, cause: original });
  });
});
