import { getEnv } from "@/shared/config/env";
import { TranscriptionError, isAppError } from "@/shared/lib/errors";
import { logger } from "@/shared/lib/logger";
import { buildWhisperPrompt } from "./prompt";
import { createGroqProvider } from "./providers/groq";
import { createLocalProvider } from "./providers/local";
import type { TranscriptionProvider } from "./types";

export type { ProviderName, TranscribeInput, TranscribeOutput, TranscriptionProvider } from "./types";

export function getTranscriptionProvider(): TranscriptionProvider {
  const env = getEnv();
  switch (env.WHISPER_PROVIDER) {
    case "groq":
      return createGroqProvider();
    case "local":
      return createLocalProvider();
  }
}

const MAX_ATTEMPTS = 3;
const BACKOFF_MS = [1000, 2000, 4000];

/** Лимит Whisper API на размер файла (план 6.4). */
export const WHISPER_MAX_FILE_MB = 25;

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

  if (input.buffer.length > WHISPER_MAX_FILE_MB * 1024 * 1024) {
    // Понятная ошибка вместо падения провайдера (план 6.4).
    throw new TranscriptionError(`аудио больше лимита Whisper API (${WHISPER_MAX_FILE_MB} МБ)`);
  }

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
