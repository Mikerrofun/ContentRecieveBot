import type { Bot } from "grammy";
import { InputFile } from "grammy";
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

/** Транскрипт дублируется в чат файлом (.txt), помимо записи в БД. */
async function sendTranscriptFile(
  bot: Bot,
  chatId: number,
  filename: string,
  content: string
): Promise<void> {
  const file = new InputFile(Buffer.from(content, "utf-8"), filename);
  await bot.api.sendDocument(chatId, file);
}

/** Отдаёт отчёт, затем файл с транскриптом. */
export function createSink(bot: Bot): OutputSink {
  return {
    async deliver(input: SinkInput): Promise<void> {
      await sendReport(bot, input.chatId, input.report);
      await sendTranscriptFile(
        bot,
        input.chatId,
        input.transcriptFile.filename,
        input.transcriptFile.content
      );
    },
  };
}
