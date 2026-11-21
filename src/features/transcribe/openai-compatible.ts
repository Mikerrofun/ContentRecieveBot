import { TranscriptionError } from "@/shared/lib/errors";

/**
 * Groq и OpenAI используют OpenAI-совместимый эндпоинт расшифровки —
 * один клиент с разным baseURL/ключом/моделью.
 */
export interface OpenAICompatibleConfig {
  name: "groq" | "openai";
  baseURL: string;
  apiKey: string;
  model: string;
}

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

export async function transcribeViaOpenAICompatible(
  config: OpenAICompatibleConfig,
  input: TranscribeInput
): Promise<TranscribeOutput> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(input.buffer)], { type: input.mime }), input.filename);
  form.append("model", config.model);
  form.append("language", input.language);
  form.append("temperature", "0");
  form.append("response_format", "json");
  if (input.prompt) form.append("prompt", input.prompt);

  let response: Response;
  try {
    response = await fetch(`${config.baseURL}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });
  } catch (e) {
    throw new TranscriptionError(e instanceof Error ? e.message : "сетевая ошибка");
  }

  if (!response.ok) {
    // Тело ответа может содержать данные пользователя — в лог не идёт,
    // пользователю отдаётся только статус.
    throw new TranscriptionError(`${config.name} API вернул ${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as { text?: string; duration?: number } | null;
  if (!data || typeof data.text !== "string") {
    throw new TranscriptionError("пустой ответ провайдера");
  }

  return {
    text: data.text,
    durationSec: typeof data.duration === "number" ? data.duration : undefined,
    model: config.model,
  };
}
