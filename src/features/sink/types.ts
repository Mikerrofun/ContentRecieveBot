import type { TranscriptFile } from "@/features/transcript-file";

/**
 * Типы выдачи результата. Реализация живёт в слое presentation (bot/lib/sink):
 * юзер получает отчёт и файл с транскриптом, текст также уходит в БД
 * (entities/material).
 */

export interface SinkInput {
  chatId: number;
  report: string[];
  transcriptFile: TranscriptFile;
}

export interface OutputSink {
  deliver(input: SinkInput): Promise<void>;
}
