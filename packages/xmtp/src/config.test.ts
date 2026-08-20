import { describe, expect, it } from "vitest";

import { getMeterMeshXmtpConfig, XmtpConfigError } from "./config.js";

const walletKey = `0x${"11".repeat(32)}`;
const dbKey = `0x${"22".repeat(32)}`;

describe("MeterMesh XMTP configuration", () => {
  it("defaults to the dev network and an ignored persistent database path", () => {
    const config = getMeterMeshXmtpConfig({
      XMTP_DB_ENCRYPTION_KEY: dbKey,
      XMTP_WALLET_KEY: walletKey,
    });

    expect(config).toMatchObject({
      appVersion: "metermesh-agent/0.1.0",
      dbEncryptionKey: dbKey,
      env: "dev",
      walletKey,
    });
    expect(config.dbPath).toMatch(/\.xmtp[/\\]metermesh-seller\.db3$/u);
  });

  it.each([
    [{ XMTP_DB_ENCRYPTION_KEY: dbKey }, "XMTP_WALLET_KEY"],
    [{ XMTP_WALLET_KEY: walletKey }, "XMTP_DB_ENCRYPTION_KEY"],
    [
      { XMTP_DB_ENCRYPTION_KEY: dbKey, XMTP_ENV: "unknown", XMTP_WALLET_KEY: walletKey },
      "XMTP_ENV",
    ],
  ])("rejects unsafe or incomplete configuration", (environment, expected) => {
    expect(() => getMeterMeshXmtpConfig(environment)).toThrow(XmtpConfigError);
    expect(() => getMeterMeshXmtpConfig(environment)).toThrow(expected);
  });
});
