/**
 * Типы выдачи результата (план 7). Реализации живут в слое presentation
 * (bot/lib/sink): TelegramSink отдаёт файл + отчёт, SystemSink (позже) отправит
 * данные в основную систему и вернёт только отчёт.
 */

export interface SinkInput {
  chatId: number;
  text: string;
  report: string[];
  /** Имя файла без расширения, например result-21.11.2026-02-15 */
  fileBaseName: string;
}

export interface OutputSink {
  deliver(input: SinkInput): Promise<void>;
}
