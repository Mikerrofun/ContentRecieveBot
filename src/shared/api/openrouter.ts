import { getEnv } from "@/shared/config/env";
import { RetryableError } from "@/shared/lib/net";
import type { ChatCompletionInput, ChatCompletionResult } from "./openrouter.types";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

/**
 * Один вызов chat/completions на OpenRouter. Сетевые сбои, таймауты и
 * HTTP-ошибки бросают RetryableError со статусом; пустой ответ модели —
 * RetryableError без статуса (тоже повод повторить).
 */
export async function callChatCompletion(input: ChatCompletionInput): Promise<ChatCompletionResult> {
  const env = getEnv();
  const signal = input.signal ?? AbortSignal.timeout(env.LLM_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: input.model,
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        max_tokens: input.maxTokens,
        temperature: 0,
      }),
      signal,
    });
  } catch (e) {
    throw new RetryableError(e instanceof Error ? e.message : "сетевая ошибка");
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((j: OpenRouterResponse) => j.error?.message ?? "")
      .catch(() => "");
    throw new RetryableError(`openrouter вернул ${response.status}${detail ? `: ${detail}` : ""}`, response.status);
  }

  const data = (await response.json().catch(() => null)) as OpenRouterResponse | null;
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || text.trim() === "") {
    throw new RetryableError("пустой ответ модели");
  }

  return {
    text,
    model: input.model,
    usage: {
      input: data?.usage?.prompt_tokens ?? 0,
      output: data?.usage?.completion_tokens ?? 0,
    },
  };
}