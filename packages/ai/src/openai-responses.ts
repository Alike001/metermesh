import { z } from "zod";

import { aiNarrativeSchema, type AiNarrative } from "./schema.js";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna" as const;
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b" as const;

export type AiProviderName = "groq" | "openai";

export type AiProviderFailureCode =
  | "missing_api_key"
  | "authentication_failed"
  | "quota_exhausted"
  | "rate_limited"
  | "provider_unavailable"
  | "request_failed"
  | "incomplete_response"
  | "refused"
  | "invalid_output";

export class AiProviderError extends Error {
  readonly billable = false;

  constructor(
    readonly code: AiProviderFailureCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "AiProviderError";
  }
}

export interface NarrativeRequest {
  factsJson: string;
  model: string;
}

export interface NarrativeResponse {
  narrative: AiNarrative;
  provider: AiProviderName;
  model: string;
  responseId: string;
}

export interface NarrativeProvider {
  createNarrative(request: NarrativeRequest): Promise<NarrativeResponse>;
}

export interface OpenAIResponsesClientOptions {
  apiKey?: string;
  endpoint?: string;
  fetchImplementation?: typeof fetch;
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export type GroqResponsesClientOptions = OpenAIResponsesClientOptions;

const openAIResponseSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  status: z.enum(["completed", "failed", "in_progress", "incomplete"]),
  incomplete_details: z.object({ reason: z.string().nullable().optional() }).nullable().optional(),
  output: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("message"),
        content: z.array(
          z.discriminatedUnion("type", [
            z.object({ type: z.literal("output_text"), text: z.string() }),
            z.object({ type: z.literal("refusal"), refusal: z.string() }),
          ]),
        ),
      }),
      z.looseObject({ type: z.literal("reasoning") }),
    ]),
  ),
});

const narrativeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string", minLength: 1, maxLength: 500 },
    outcome: { type: "string", minLength: 1, maxLength: 500 },
    limitations: {
      type: "array",
      maxItems: 4,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
  },
  required: ["summary", "outcome", "limitations"],
} as const;

const instructions = `You explain one X Layer Testnet transaction to a non-technical user.
Use only the supplied normalized RPC facts. Never invent contract names, token names, function names, event names, revert reasons, intent, ownership, or offchain context.
State clearly when calldata and event logs are undecoded. A successful receipt proves EVM execution succeeded, not that a user achieved an unstated goal. A reverted receipt has no known revert reason unless the facts explicitly include one.
Write a concise summary and outcome. Put material uncertainty in limitations.`;

const providerErrorBodySchema = z.object({
  error: z
    .object({
      code: z.string().nullable().optional(),
      type: z.string().nullable().optional(),
      failed_generation: z.unknown().optional(),
    })
    .optional(),
});

function isQuotaExhausted(payload: unknown): boolean {
  const parsed = providerErrorBodySchema.safeParse(payload);
  if (!parsed.success) return false;
  return (
    parsed.data.error?.code === "insufficient_quota" ||
    parsed.data.error?.type === "insufficient_quota"
  );
}

function isGenerationFailure(payload: unknown): boolean {
  const parsed = providerErrorBodySchema.safeParse(payload);
  return parsed.success && parsed.data.error?.failed_generation !== undefined;
}

function retryableStatus(status: number, payload: unknown): boolean {
  if (isQuotaExhausted(payload)) return false;
  return (
    (status === 400 && isGenerationFailure(payload)) ||
    status === 408 ||
    status === 409 ||
    status === 429 ||
    status >= 500
  );
}

function errorForStatus(status: number, payload: unknown, providerLabel: string): AiProviderError {
  if (status === 401 || status === 403) {
    return new AiProviderError(
      "authentication_failed",
      `${providerLabel} rejected the server credential.`,
    );
  }
  if (isQuotaExhausted(payload)) {
    return new AiProviderError(
      "quota_exhausted",
      `The ${providerLabel} project has no available API quota or credit.`,
    );
  }
  if (status === 429) {
    return new AiProviderError(
      "rate_limited",
      `${providerLabel} rate-limited the explanation request.`,
    );
  }
  if (status >= 500 || status === 408 || status === 409) {
    return new AiProviderError(
      "provider_unavailable",
      `${providerLabel} could not complete the explanation request.`,
    );
  }
  return new AiProviderError(
    "request_failed",
    `${providerLabel} rejected the explanation request with HTTP ${String(status)}.`,
  );
}

function parseNarrativeResponse(
  payload: unknown,
  provider: AiProviderName,
  providerLabel: string,
): NarrativeResponse {
  const response = openAIResponseSchema.safeParse(payload);
  if (!response.success) {
    throw new AiProviderError(
      "invalid_output",
      `${providerLabel} returned a response outside the expected Responses API shape.`,
      { cause: response.error },
    );
  }
  if (response.data.status !== "completed") {
    throw new AiProviderError(
      "incomplete_response",
      `${providerLabel} response was ${response.data.status}.`,
    );
  }

  const message = response.data.output.find((item) => item.type === "message");
  const refusal = message?.content.find((item) => item.type === "refusal");
  if (refusal?.type === "refusal") {
    throw new AiProviderError("refused", `${providerLabel} refused the explanation.`);
  }
  const output = message?.content.find((item) => item.type === "output_text");
  if (output?.type !== "output_text") {
    throw new AiProviderError(
      "invalid_output",
      `${providerLabel} completed without structured output text.`,
    );
  }

  try {
    return {
      narrative: aiNarrativeSchema.parse(JSON.parse(output.text) as unknown),
      provider,
      model: response.data.model,
      responseId: response.data.id,
    };
  } catch (error) {
    throw new AiProviderError(
      "invalid_output",
      `${providerLabel} output did not satisfy MeterMesh's strict narrative schema.`,
      { cause: error },
    );
  }
}

type ResponsesClientConfiguration = Omit<OpenAIResponsesClientOptions, "apiKey"> & {
  apiKey: string | undefined;
  apiKeyName: "GROQ_API_KEY" | "OPENAI_API_KEY";
  defaultEndpoint: string;
  provider: AiProviderName;
  providerLabel: string;
  reasoningEffort: "low" | "none";
};

function createResponsesClient(configuration: ResponsesClientConfiguration): NarrativeProvider {
  const apiKey = configuration.apiKey;
  if (!apiKey?.trim()) {
    throw new AiProviderError(
      "missing_api_key",
      `${configuration.apiKeyName} is required in the server environment.`,
    );
  }

  const endpoint = configuration.endpoint ?? configuration.defaultEndpoint;
  const fetchImplementation = configuration.fetchImplementation ?? fetch;
  const maxRetries = configuration.maxRetries ?? 2;
  const retryDelayMs = configuration.retryDelayMs ?? 250;
  const timeoutMs = configuration.timeoutMs ?? 15_000;

  return {
    async createNarrative(request) {
      const body = {
        model: request.model,
        instructions,
        input: `Normalized X Layer RPC facts:\n${request.factsJson}`,
        max_output_tokens: 700,
        reasoning: { effort: configuration.reasoningEffort },
        text: {
          format: {
            type: "json_schema",
            name: "meter_mesh_transaction_narrative",
            strict: true,
            schema: narrativeJsonSchema,
          },
        },
      };

      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const response = await fetchImplementation(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
          });

          if (!response.ok) {
            const errorPayload: unknown = await response.json().catch(() => null);
            const providerError = errorForStatus(
              response.status,
              errorPayload,
              configuration.providerLabel,
            );
            if (attempt < maxRetries && retryableStatus(response.status, errorPayload)) {
              lastError = providerError;
              await new Promise((resolve) => {
                setTimeout(resolve, retryDelayMs * 2 ** attempt);
              });
              continue;
            }
            throw providerError;
          }
          return parseNarrativeResponse(
            await response.json(),
            configuration.provider,
            configuration.providerLabel,
          );
        } catch (error) {
          if (error instanceof AiProviderError) throw error;
          lastError = error;
          if (attempt === maxRetries) break;
          await new Promise((resolve) => {
            setTimeout(resolve, retryDelayMs * 2 ** attempt);
          });
        }
      }

      throw new AiProviderError(
        "provider_unavailable",
        `${configuration.providerLabel} could not be reached before the retry limit.`,
        { cause: lastError },
      );
    },
  };
}

export function createOpenAIResponsesClient(
  options: OpenAIResponsesClientOptions = {},
): NarrativeProvider {
  return createResponsesClient({
    ...options,
    apiKey: options.apiKey ?? process.env.OPENAI_API_KEY,
    apiKeyName: "OPENAI_API_KEY",
    defaultEndpoint: "https://api.openai.com/v1/responses",
    provider: "openai",
    providerLabel: "OpenAI",
    reasoningEffort: "none",
  });
}

export function createGroqResponsesClient(
  options: GroqResponsesClientOptions = {},
): NarrativeProvider {
  return createResponsesClient({
    ...options,
    apiKey: options.apiKey ?? process.env.GROQ_API_KEY,
    apiKeyName: "GROQ_API_KEY",
    defaultEndpoint: "https://api.groq.com/openai/v1/responses",
    provider: "groq",
    providerLabel: "Groq",
    reasoningEffort: "low",
  });
}
