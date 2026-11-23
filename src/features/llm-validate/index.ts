import PQueue from "p-queue";
import { getEnv } from "@/shared/config/env";
import { callChatCompletion } from "@/shared/api/openrouter";
import type { TokenUsage } from "@/shared/api/openrouter.types";
import { RetryableError, withRetry } from "@/shared/lib/net";
import { logger } from "@/shared/lib/logger";
import {
  FALLBACK_MODEL,
  GLOBAL_ERROR_STATUSES,
  LLM_CONTEXT_CHARS,
  PRIMARY_ATTEMPTS,
  PRIMARY_BACKOFF_MS,
  PRIMARY_MODEL,
  PRICE_PER_1M,
} from "./config";
import { joinChunks, splitIntoChunks } from "./chunk";
import { LLM_SYSTEM_PROMPT, buildUserMessage } from "./prompt";

export type ChunkStatus = "ok-primary" | "ok-fallback" | "reverted";

/** Чанк с read-only контекстом соседей (в вывод модели не попадает). */
export interface LlmChunk {
  index: number;
  text: string;
  contextBefore?: string;
  contextAfter?: string;
}

/** Итог по одному чанку. */
export interface ChunkResult {
  index: number;
  status: ChunkStatus;
  text: string;
  model?: string;
  usage?: TokenUsage;
}

export interface LlmUsageSummary {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** Сводка по всему прогону LLM. */
export interface LlmValidateResult {
  status: "done" | "failed";
  text: string;
  charsBefore: number;
  charsAfter: number;
  chunksTotal: number;
  chunkResults: ChunkResult[];
  primaryModel: string;
  fallbackModel: string;
  usage: LlmUsageSummary;
  error?: string;
}

function isGlobalError(error: unknown): error is RetryableError {
  return (
    error instanceof RetryableError &&
    error.status !== undefined &&
    GLOBAL_ERROR_STATUSES.has(error.status)
  );
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildChunks(text: string, maxTokens: number): LlmChunk[] {
  const parts = splitIntoChunks(text, maxTokens);
  return parts.map((chunk, index) => ({
    index,
    text: chunk,
    contextBefore: index > 0 ? parts[index - 1].slice(-LLM_CONTEXT_CHARS) : undefined,
    contextAfter: index < parts.length - 1 ? parts[index + 1].slice(0, LLM_CONTEXT_CHARS) : undefined,
  }));
}

function summarizeUsage(results: ChunkResult[]): LlmUsageSummary {
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  for (const r of results) {
    if (!r.usage) continue;
    inputTokens += r.usage.input;
    outputTokens += r.usage.output;
    const price = PRICE_PER_1M[r.model ?? PRIMARY_MODEL] ?? { input: 0, output: 0 };
    costUsd += (r.usage.input / 1_000_000) * price.input + (r.usage.output / 1_000_000) * price.output;
  }
  return { inputTokens, outputTokens, costUsd };
}

async function processChunk(chunk: LlmChunk, maxTokens: number, timeoutMs: number): Promise<ChunkResult> {
  const user = buildUserMessage(chunk);

  try {
    const res = await withRetry(
      (_attempt, signal) =>
        callChatCompletion({
          model: PRIMARY_MODEL,
          system: LLM_SYSTEM_PROMPT,
          user,
          maxTokens,
          signal,
        }),
      {
        attempts: PRIMARY_ATTEMPTS,
        backoffMs: PRIMARY_BACKOFF_MS,
        timeoutMs,
      }
    );

    return { index: chunk.index, status: "ok-primary", text: res.text, model: PRIMARY_MODEL, usage: res.usage };
  } catch (e) {
    if (isGlobalError(e)) throw e;
    logger.warn("llm primary failed", { index: chunk.index, error: errorText(e) });
  }

  try {
    const res = await callChatCompletion({
      model: FALLBACK_MODEL,
      system: LLM_SYSTEM_PROMPT,
      user,
      maxTokens,
      signal: AbortSignal.timeout(timeoutMs),
    });

    return { index: chunk.index, status: "ok-fallback", text: res.text, model: FALLBACK_MODEL, usage: res.usage };
  } catch (e) {
    if (isGlobalError(e)) throw e;
    logger.warn("llm fallback failed", { index: chunk.index, error: errorText(e) });
    return { index: chunk.index, status: "reverted", text: chunk.text };
  }
}

/** Готовит неуспешный результат LLM-прогона (текст остаётся после функций). */
export function llmFailedResult(text: string, error: string): LlmValidateResult {
  return {
    status: "failed",
    text,
    charsBefore: text.length,
    charsAfter: text.length,
    chunksTotal: 0,
    chunkResults: [],
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
    error,
  };
}

/**
 * Финальный LLM-проход: режет текст на чанки, гоняет их через p-queue, на каждый
 * чанк — withRetry(GLM) → при 3 неудачах Qwen (без ретраев) → при провале обеих
 * моделей откат к исходному тексту чанка. Результаты собираются по индексу,
 * поэтому параллельные ответы не ломают порядок.
 */
export async function llmValidate(text: string): Promise<LlmValidateResult> {
  const env = getEnv();
  const maxTokens = env.LLM_CHUNK_MAX_TOKENS;
  const concurrency = env.LLM_CONCURRENCY;
  const timeoutMs = env.LLM_TIMEOUT_MS;

  const chunks = buildChunks(text, maxTokens);
  const queue = new PQueue({ concurrency });
  const results: Array<ChunkResult | undefined> = new Array(chunks.length);
  const globalErrors: RetryableError[] = [];

  const tasks = chunks.map((chunk) =>
    queue.add(async () => {
      if (globalErrors.length > 0) return;
      try {
        results[chunk.index] = await processChunk(chunk, maxTokens, timeoutMs);
      } catch (e) {
        if (isGlobalError(e)) {
          globalErrors.push(e);
          return;
        }
        results[chunk.index] = { index: chunk.index, status: "reverted", text: chunk.text };
      }
    })
  );

  await Promise.all(tasks);

  if (globalErrors.length > 0) {
    const globalError = globalErrors[0];
    logger.error("llm run aborted", { status: globalError.status, error: errorText(globalError) });
    return {
      status: "failed",
      text,
      charsBefore: text.length,
      charsAfter: text.length,
      chunksTotal: chunks.length,
      chunkResults: [],
      primaryModel: PRIMARY_MODEL,
      fallbackModel: FALLBACK_MODEL,
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 },
      error: `ошибка LLM (${globalError.status}): ${errorText(globalError)}`,
    };
  }

  const finalResults: ChunkResult[] = results.map(
    (r, i) => r ?? { index: i, status: "reverted", text: chunks[i].text }
  );
  const joined = joinChunks(finalResults.map((r) => r.text));

  logger.info("llm validate done", {
    chunks: finalResults.length,
    primary: finalResults.filter((r) => r.status === "ok-primary").length,
    fallback: finalResults.filter((r) => r.status === "ok-fallback").length,
    reverted: finalResults.filter((r) => r.status === "reverted").length,
  });

  return {
    status: "done",
    text: joined,
    charsBefore: text.length,
    charsAfter: joined.length,
    chunksTotal: finalResults.length,
    chunkResults: finalResults,
    primaryModel: PRIMARY_MODEL,
    fallbackModel: FALLBACK_MODEL,
    usage: summarizeUsage(finalResults),
  };
}