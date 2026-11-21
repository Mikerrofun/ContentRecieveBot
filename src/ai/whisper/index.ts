import { getEnv } from "@/config/env";
import { TranscriptionError, isAppError } from "@/shared/errors";
import { logger } from "@/shared/logger";
import { buildWhisperPrompt } from "@/prompts/whisper-prompt";
import { createGroqProvider } from "./providers/groq";
import { createOpenAIProvider } from "./providers/openai";
import { createLocalProvider } from "./providers/local";

export type ProviderName = "groq" | "openai" | "local";

export interface TranscriptionProvider {
  name: ProviderName;
  transcribe(input: {
    buffer: Buffer;
    filename: string;
    mime: string;
    language: "ru";
    prompt?: string;
  }): Promise<{ text: string; durationSec?: number; model: string }>;
}

export function getTranscriptionProvider(): TranscriptionProvider {
  const env = getEnv();
  switch (env.WHISPER_PROVIDER) {
    case "groq":
      return createGroqProvider();
    case "openai":
      return createOpenAIProvider();
    case "local":
      return createLocalProvider();
  }
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryable(e: unknown): boolean {
  if (!(e instanceof TranscriptionError)) return false;
  // Ретраятся только временные сбои сети/API; ошибки формата — нет.
  return /сетевая ошибка|вернул (429|5\d\d)/.test(e.userMessage);
}

/**
 * Расшифровка с ретраями (до 3 попыток с нарастающей паузой).
 * language=ru, temperature=0, plain text без таймкодов.
 */
export async function transcribeAudio(input: {
  buffer: Buffer;
  filename: string;
  mime: string;
  /** Вызывается перед каждой повторной попыткой (для сообщения «Повторяю…»). */
  onAttemptFail?: () => Promise<void> | void;
}): Promise<{ text: string; durationSec?: number; provider: string; model: string }> {
  const env = getEnv();
  const provider = getTranscriptionProvider();
  const prompt = buildWhisperPrompt();

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await provider.transcribe({
        buffer: input.buffer,
        filename: input.filename,
        mime: input.mime,
        language: "ru",
        prompt,
      });
      return { ...res, provider: provider.name };
    } catch (e) {
      lastError = e;
      logger.warn("transcription attempt failed", { attempt, provider: provider.name });
      if (!isRetryable(e) || attempt === MAX_ATTEMPTS) break;
      await input.onAttemptFail?.();
      await sleep(BACKOFF_MS[attempt - 1]);
    }
  }

  if (isAppError(lastError)) throw lastError;
  throw new TranscriptionError();
}
