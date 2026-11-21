import { transcribeViaOpenAICompatible, type TranscribeInput, type TranscribeOutput } from "../openai-compatible";
import type { TranscriptionProvider } from "../index";
import { getEnv } from "@/shared/config/env";

/** Groq Cloud — Whisper-совместимый API (https://api.groq.com/openai/v1). */
export function createGroqProvider(): TranscriptionProvider {
  const env = getEnv();
  const config = {
    name: "groq" as const,
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: env.GROQ_API_KEY,
    model: env.GROQ_WHISPER_MODEL,
  };

  return {
    name: "groq",
    async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
      return transcribeViaOpenAICompatible(config, input);
    },
  };
}
