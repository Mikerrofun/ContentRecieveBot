import { getEnv } from "@/shared/config/env";
import { TranscriptionError, isAppError } from "@/shared/lib/errors";
import { logger } from "@/shared/lib/logger";
import { withRetry } from "@/shared/lib/net";
import {
  TRANSCRIBE_RETRY_ATTEMPTS,
  TRANSCRIBE_RETRY_BACKOFF_MS,
  WHISPER_MAX_FILE_MB,
} from "./config";
import { buildWhisperPrompt } from "./prompt";
import { createGroqProvider } from "./providers/groq";
import { createLocalProvider } from "./providers/local";
import type { TranscribeAudioInput, TranscribeAudioOutput, TranscriptionProvider } from "./types";

export type {
  ProviderName,
  TranscribeInput,
  TranscribeOutput,
  TranscriptionProvider,
  TranscribeAudioInput,
  TranscribeAudioOutput,
} from "./types";

export function getTranscriptionProvider(): TranscriptionProvider {
  const env = getEnv();
  switch (env.WHISPER_PROVIDER) {
    case "groq":
      return createGroqProvider();
    case "local":
      return createLocalProvider();
  }
}

/** Ретраятся только временные сбои сети/API; ошибки формата — нет. */
function isRetryableTranscriptionError(e: unknown): boolean {
  return e instanceof TranscriptionError && /сетевая ошибка|вернул (429|5\d\d)/.test(e.userMessage);
}

/**
 * Расшифровка с ретраями (до 3 попыток с нарастающей паузой).
 * language=ru, temperature=0, plain text без таймкодов.
 */
export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  const provider = getTranscriptionProvider();
  const prompt = buildWhisperPrompt();

  if (input.buffer.length > WHISPER_MAX_FILE_MB * 1024 * 1024) {
    // Понятная ошибка вместо падения провайдера (план 6.4).
    throw new TranscriptionError(`аудио больше лимита Whisper API (${WHISPER_MAX_FILE_MB} МБ)`);
  }

  try {
    const res = await withRetry(
      () =>
        provider.transcribe({
          buffer: input.buffer,
          filename: input.filename,
          mime: input.mime,
          language: "ru",
          prompt,
        }),
      {
        attempts: TRANSCRIBE_RETRY_ATTEMPTS,
        backoffMs: TRANSCRIBE_RETRY_BACKOFF_MS,
        shouldRetry: isRetryableTranscriptionError,
        onAttemptFail: async (attempt) => {
          logger.warn("transcription attempt failed", { attempt, provider: provider.name });
          await input.onAttemptFail?.();
        },
      }
    );
    return { ...res, provider: provider.name };
  } catch (e) {
    if (isAppError(e)) throw e;
    throw new TranscriptionError();
  }
}