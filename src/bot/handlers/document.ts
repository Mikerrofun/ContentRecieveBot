import type { Bot } from "grammy";
import { getEnv } from "@/config/env";
import { messages } from "@/bot/messages";
import { addItem, findActiveSession } from "@/services/session";
import { extractText } from "@/parser";
import { downloadTelegramFile } from "./download";
import { flushPendingTextPrompt, sendAcceptPrompt } from "./prompts";
import { userMessageFor } from "./errors";
import { processAudio } from "./audio";

export function registerDocumentHandler(bot: Bot): void {
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    const env = getEnv();
    const session = findActiveSession(ctx.chat.id);
    if (!session || session.status !== "collecting") {
      await ctx.reply(messages.noSession());
      return;
    }
    await flushPendingTextPrompt(bot, session);

    // Аудио, присланное как документ, идёт через аудио-конвейер
    if (doc.mime_type?.startsWith("audio/")) {
      await processAudio(bot, ctx, session, {
        kind: "audio",
        fileId: doc.file_id,
        durationSec: undefined,
        fileName: doc.file_name ?? `audio-${ctx.message.message_id}`,
        mime: doc.mime_type,
        label: doc.file_name ?? "аудио",
      });
      return;
    }

    const sizeMb = doc.file_size ? doc.file_size / (1024 * 1024) : 0;
    if (doc.file_size && doc.file_size > env.MAX_FILE_MB * 1024 * 1024) {
      await ctx.reply(messages.fileTooLarge(sizeMb, env.MAX_FILE_MB));
      return;
    }

    // Подпись к файлу — отдельный текстовый элемент перед файлом
    if (ctx.message.caption) {
      addItem(session, {
        id: crypto.randomUUID(),
        kind: "text",
        label: `подпись (${ctx.message.caption.length} симв.)`,
        rawText: ctx.message.caption,
        meta: { source: "text" },
      });
    }

    try {
      const file = await ctx.api.getFile(doc.file_id);
      const buffer = await downloadTelegramFile(env.TELEGRAM_BOT_TOKEN, file.file_path ?? "");
      const { text, source } = await extractText({
        buffer,
        fileName: doc.file_name,
        mime: doc.mime_type,
      });
      addItem(session, {
        id: crypto.randomUUID(),
        kind: "file",
        label: doc.file_name ?? "файл",
        rawText: text,
        meta: { fileName: doc.file_name, source },
      });
      await sendAcceptPrompt(bot, session);
    } catch (e) {
      await ctx.reply(userMessageFor(e));
    }
  });
}
