import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { transactionExplanationSchema } from "../../../../packages/ai/src/schema";
import {
  X_LAYER_TESTNET_CHAIN_ID,
  X_LAYER_TESTNET_MPP_ESCROW_ADDRESS,
  X_LAYER_TESTNET_USDT0_ADDRESS,
} from "../../../../packages/chain/src/x-layer";
import { envelopeDraftSchema } from "../../../../packages/protocol/src/schema";
import { describe, expect, it, vi } from "vitest";

import manifestJson from "../../public/.well-known/metermesh.json";
import openApiJson from "../../public/openapi.json";
import {
  COPYABLE_REQUEST_EXAMPLE,
  DOCUMENTATION_ARTIFACTS,
  loadDocumentationArtifacts,
  parseMeterMeshManifest,
} from "./documentation";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(currentDirectory, "../..");

describe("MeterMesh machine-readable documentation", () => {
  it("strictly parses the service manifest and rejects unknown top-level fields", () => {
    expect(parseMeterMeshManifest(manifestJson)).toMatchObject({
      name: "MeterMesh",
      schemaVersion: "1.0",
      version: "0.1.0",
    });
    expect(() => parseMeterMeshManifest({ ...manifestJson, invented: true })).toThrow(
      "unexpected or missing fields",
    );
  });

  it("validates copyable examples through the canonical product schemas", () => {
    expect(COPYABLE_REQUEST_EXAMPLE).toEqual(manifestJson.examples.request);
    expect(() => envelopeDraftSchema.parse(COPYABLE_REQUEST_EXAMPLE)).not.toThrow();
    expect(() => envelopeDraftSchema.parse(manifestJson.examples.request)).not.toThrow();
    expect(() =>
      transactionExplanationSchema.parse(manifestJson.examples.explanation),
    ).not.toThrow();
    expect(manifestJson.examples.explanation.transactionHash).toBe(
      manifestJson.examples.request.payload.transactionHash,
    );
  });

  it("fails closed when a required artifact is missing or malformed", async () => {
    const missingArtifact = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("missing", { status: 404 }));
    await expect(loadDocumentationArtifacts(missingArtifact)).rejects.toThrow(
      "Machine discovery is unavailable",
    );

    const malformedOpenApi = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(manifestJson))
      .mockResolvedValueOnce(Response.json({ openapi: "3.0.0", paths: {} }));
    await expect(loadDocumentationArtifacts(malformedOpenApi)).rejects.toThrow(
      "OpenAPI document is malformed",
    );
  });

  it("uses canonical X Layer identifiers and honest capability gates", () => {
    expect(manifestJson.network.chainId).toBe(X_LAYER_TESTNET_CHAIN_ID);
    expect(manifestJson.network.mppEscrowAddress).toBe(X_LAYER_TESTNET_MPP_ESCROW_ADDRESS);
    expect(manifestJson.network.paymentToken.address).toBe(X_LAYER_TESTNET_USDT0_ADDRESS);
    expect(manifestJson.capabilityStatus).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "xmtp-carrier", state: "verified" }),
        expect.objectContaining({ id: "bounded-public-trial", state: "verified" }),
        expect.objectContaining({ id: "proof-anchor-source", state: "gated" }),
        expect.objectContaining({ id: "mpp-testnet-mutation", state: "gated" }),
      ]),
    );
  });

  it("publishes only built GET resources in OpenAPI and keeps every local link readable", async () => {
    const expectedPaths = [
      "/docs/",
      "/.well-known/metermesh.json",
      "/openapi.json",
      "/llms.txt",
      "/evidence/captured-session.json",
    ];
    expect(Object.keys(openApiJson.paths).sort()).toEqual(expectedPaths.sort());
    for (const pathItem of Object.values(openApiJson.paths)) {
      expect(Object.keys(pathItem)).toEqual(["get"]);
    }

    const localFiles = [
      resolve(webRoot, "docs/index.html"),
      resolve(webRoot, "public/.well-known/metermesh.json"),
      resolve(webRoot, "public/openapi.json"),
      resolve(webRoot, "public/llms.txt"),
      resolve(webRoot, "public/evidence/captured-session.json"),
    ];
    await Promise.all(localFiles.map((file) => access(file)));
    expect(DOCUMENTATION_ARTIFACTS).toHaveLength(3);
    expect(await readFile(resolve(webRoot, "public/llms.txt"), "utf8")).toContain(
      "No HTTP execution endpoint is published",
    );
  });
});
