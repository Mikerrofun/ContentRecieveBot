import type { Bot } from "grammy";
import type { OutputSink, SinkInput } from "@/features/sink";

/**
 * Отчёт отправляется БЕЗ parse_mode: в него попадают примеры из текста
 * пользователя (нарушения валидатора), и Markdown-разметка в них сломала бы
 * отправку (незакрытые `*`/`_`/бэктики → ошибка Telegram API).
 */
async function sendReport(bot: Bot, chatId: number, report: string[]): Promise<void> {
  for (const message of report) {
    await bot.api.sendMessage(chatId, message);
  }
}

/** Отдаёт только отчёт: файл с текстом больше не отправляется, текст живёт в БД. */
export function createSink(bot: Bot): OutputSink {
  return {
    async deliver(input: SinkInput): Promise<void> {
      await sendReport(bot, input.chatId, input.report);
    },
  };
}
