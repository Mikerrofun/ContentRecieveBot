import type { TranscriptFile } from "./types";

export type { TranscriptFile } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function fileStamp(ts: number): string {
  const d = new Date(ts);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}-${pad(d.getMinutes())}`;
  return `${date}_${time}`;
}

/**
 * Собирает файл транскрипта для отправки в чат: transcript_YYYY-MM-DD_HH-mm.txt.
 * Чистая функция — отправка живёт в слое presentation (bot/lib/sink).
 */
export function buildTranscriptFile(text: string, createdAt: number): TranscriptFile {
  return {
    filename: `transcript_${fileStamp(createdAt)}.txt`,
    content: text,
  };
}
