/**
 * Типы выдачи результата. Реализация живёт в слое presentation (bot/lib/sink):
 * юзер получает только отчёт, очищенный текст уходит в БД (entities/material).
 */

export interface SinkInput {
  chatId: number;
  report: string[];
}

export interface OutputSink {
  deliver(input: SinkInput): Promise<void>;
}
