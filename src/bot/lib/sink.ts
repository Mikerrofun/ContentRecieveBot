import { InputFile } from "grammy";
import type { Bot } from "grammy";
import type { Env } from "@/shared/config/env";
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

/** Отдаёт результат файлом .md + отчёт сообщениями. */
export function createTelegramSink(bot: Bot): OutputSink {
  return {
    async deliver(input: SinkInput): Promise<void> {
      await bot.api.sendDocument(
        input.chatId,
        new InputFile(Buffer.from(input.text, "utf8"), `${input.fileBaseName}.md`)
      );
      await sendReport(bot, input.chatId, input.report);
    },
  };
}

/** Заглушка режима report-only: только отчёт, без файла. */
export function createReportOnlySink(bot: Bot): OutputSink {
  return {
    async deliver(input: SinkInput): Promise<void> {
      await sendReport(bot, input.chatId, input.report);
    },
  };
}

export function createSink(bot: Bot, env: Env): OutputSink {
  return env.OUTPUT_MODE === "report-only" ? createReportOnlySink(bot) : createTelegramSink(bot);
}
