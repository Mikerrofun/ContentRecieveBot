import { InputFile } from "grammy";
import type { Bot } from "grammy";
import type { Env } from "@/config/env";

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

/** Отдаёт результат файлом .md + отчёт сообщениями. */
export function createTelegramSink(bot: Bot): OutputSink {
  return {
    async deliver(input: SinkInput): Promise<void> {
      await bot.api.sendDocument(
        input.chatId,
        new InputFile(Buffer.from(input.text, "utf8"), `${input.fileBaseName}.md`)
      );
      for (const message of input.report) {
        await bot.api.sendMessage(input.chatId, message, { parse_mode: "Markdown" });
      }
    },
  };
}

/** Заглушка режима report-only: только отчёт, без файла. */
export function createReportOnlySink(bot: Bot): OutputSink {
  return {
    async deliver(input: SinkInput): Promise<void> {
      for (const message of input.report) {
        await bot.api.sendMessage(input.chatId, message, { parse_mode: "Markdown" });
      }
    },
  };
}

export function createSink(bot: Bot, env: Env): OutputSink {
  return env.OUTPUT_MODE === "report-only" ? createReportOnlySink(bot) : createTelegramSink(bot);
}
