import { transcribeViaOpenAICompatible, type TranscribeInput, type TranscribeOutput } from "../openai-compatible";
import type { TranscriptionProvider } from "../index";
import { getEnv } from "@/shared/config/env";

/** OpenAI Whisper (переключается конфигом, без правок кода). */
export function createOpenAIProvider(): TranscriptionProvider {
  const env = getEnv();
  const config = {
    name: "openai" as const,
    baseURL: "https://api.openai.com/v1",
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_WHISPER_MODEL,
  };

  return {
    name: "openai",
    async transcribe(input: TranscribeInput): Promise<TranscribeOutput> {
      return transcribeViaOpenAICompatible(config, input);
    },
  };
}
