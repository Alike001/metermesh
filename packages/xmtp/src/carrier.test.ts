import { mkdtemp, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { secureXmtpDatabasePath } from "./carrier.js";

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
