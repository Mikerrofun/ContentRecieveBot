import type { Bot } from "grammy";
import { InputFile } from "grammy";
import type { OutputSink, SinkInput } from "@/features/sink";

/**
 * Отчёт отправляется с parse_mode HTML: секция «Валидация» с примерами из
 * текста пользователя убрана, поэтому динамических фрагментов из исходника в
 * отчёте нет (только сухие счётчики, число, UUID и статичные предупреждения),
 * и разметка не ломает отправку. На всякий случай динамика экранируется в
 * buildReport.
 */
async function sendReport(bot: Bot, chatId: number, report: string[]): Promise<void> {
  for (const message of report) {
    await bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
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
