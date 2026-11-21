/**
 * Интерфейс выдачи результата (план 7). Реализации живут в слое presentation
 * (bot/lib/sink): TelegramSink отдаёт файл + отчёт, SystemSink (позже) отправит
 * данные в основную систему и вернёт только отчёт.
 */
export type { OutputSink, SinkInput } from "./types";
