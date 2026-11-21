/** Типы модуля расшифровки. Реализация — в index.ts и providers/. */

export type ProviderName = "groq" | "local";

export interface TranscribeInput {
  buffer: Buffer;
  filename: string;
  mime: string;
  language: "ru";
  prompt?: string;
}

export interface TranscribeOutput {
  text: string;
  durationSec?: number;
  model: string;
}

export interface TranscriptionProvider {
  name: ProviderName;
  transcribe(input: TranscribeInput): Promise<TranscribeOutput>;
}
