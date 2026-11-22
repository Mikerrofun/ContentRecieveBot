import { TranscriptionError } from "@/shared/lib/errors";
import type { TranscribeInput, TranscribeOutput } from "./types";

/**
 * Groq Cloud использует OpenAI-совместимый эндпоинт расшифровки —
 * один клиент настраивается baseURL/ключом/моделью.
 */
export interface OpenAICompatibleConfig {
  name: "groq";
  baseURL: string;
  apiKey: string;
  model: string;
}

export async function transcribeViaOpenAICompatible(
  config: OpenAICompatibleConfig,
  input: TranscribeInput
): Promise<TranscribeOutput> {
  // Groq проверяет расширение файла, а не MIME-тип.
  // Telegram отправляет .oga (audio/ogg), меняем расширение на .ogg
  const filename = input.filename.endsWith('.oga') 
    ? input.filename.replace(/\.oga$/, '.ogg')
    : input.filename;
  
  const form = new FormData();
  // Используем application/octet-stream — Groq сам определит формат по содержимому
  form.append("file", new Blob([new Uint8Array(input.buffer)], { type: "application/octet-stream" }), filename);
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
