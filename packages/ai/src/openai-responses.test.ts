import { describe, expect, it, vi } from "vitest";

import { AiProviderError, createOpenAIResponsesClient } from "./openai-responses.js";

function completedPayload(
  outputText = JSON.stringify({
    summary: "A verified summary.",
    outcome: "A verified outcome.",
    limitations: [],
  }),
) {
  return {
    id: "resp_123",
    model: "gpt-test",
    status: "completed",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: outputText }],
      },
    ],
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createOpenAIResponsesClient", () => {
  it("requires a server-side API key", () => {
    expect(() => createOpenAIResponsesClient({ apiKey: "" })).toThrow(AiProviderError);
  });

  it("requests strict structured output without exposing the key in the body", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(completedPayload()));
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation,
      maxRetries: 0,
    });

    const result = await client.createNarrative({
      factsJson: '{"chainId":1952}',
      model: "gpt-test",
    });

    expect(result.responseId).toBe("resp_123");
    const [, request] = fetchImplementation.mock.calls[0] ?? [];
    expect(request?.headers).toMatchObject({
      Authorization: "Bearer test-api-key",
    });
    const requestBody = request?.body;
    expect(typeof requestBody).toBe("string");
    if (typeof requestBody !== "string") throw new Error("Expected a JSON request body.");
    expect(requestBody).not.toContain("test-api-key");
    expect(JSON.parse(requestBody)).toMatchObject({
      model: "gpt-test",
      reasoning: { effort: "none" },
      text: {
        format: {
          type: "json_schema",
          strict: true,
        },
      },
    });
  });

  it("does not retry rejected credentials", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response({ error: {} }, 401));
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation,
      maxRetries: 2,
    });

    await expect(
      client.createNarrative({ factsJson: "{}", model: "gpt-test" }),
    ).rejects.toMatchObject({
      billable: false,
      code: "authentication_failed",
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("retries a transient rate limit and then succeeds", async () => {
    const fetchImplementation = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: {} }, 429))
      .mockResolvedValueOnce(response(completedPayload()));
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation,
      maxRetries: 1,
      retryDelayMs: 0,
    });

    await expect(
      client.createNarrative({ factsJson: "{}", model: "gpt-test" }),
    ).resolves.toMatchObject({ responseId: "resp_123" });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("classifies exhausted API quota and does not retry", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      response(
        {
          error: {
            type: "insufficient_quota",
            code: "insufficient_quota",
          },
        },
        429,
      ),
    );
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation,
      maxRetries: 2,
    });

    await expect(
      client.createNarrative({ factsJson: "{}", model: "gpt-test" }),
    ).rejects.toMatchObject({ billable: false, code: "quota_exhausted" });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("treats incomplete responses as nonbillable", async () => {
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        response({
          ...completedPayload(),
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
        }),
      ),
      maxRetries: 0,
    });

    await expect(
      client.createNarrative({ factsJson: "{}", model: "gpt-test" }),
    ).rejects.toMatchObject({ billable: false, code: "incomplete_response" });
  });

  it("treats refusals as nonbillable", async () => {
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        response({
          ...completedPayload(),
          output: [
            {
              type: "message",
              content: [{ type: "refusal", refusal: "Cannot comply." }],
            },
          ],
        }),
      ),
      maxRetries: 0,
    });

    await expect(
      client.createNarrative({ factsJson: "{}", model: "gpt-test" }),
    ).rejects.toMatchObject({ billable: false, code: "refused" });
  });

  it("rejects malformed or extra narrative fields", async () => {
    const client = createOpenAIResponsesClient({
      apiKey: "test-api-key",
      fetchImplementation: vi.fn<typeof fetch>().mockResolvedValue(
        response(
          completedPayload(
            JSON.stringify({
              summary: "Summary",
              outcome: "Outcome",
              limitations: [],
              inventedContractName: "FakeSwap",
            }),
          ),
        ),
      ),
      maxRetries: 0,
    });

    await expect(
      client.createNarrative({ factsJson: "{}", model: "gpt-test" }),
    ).rejects.toMatchObject({ billable: false, code: "invalid_output" });
  });
});
