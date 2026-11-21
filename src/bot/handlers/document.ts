import type { Bot } from "grammy";
import { getEnv } from "@/shared/config/env";
import { FileTooLargeError } from "@/shared/lib/errors";
import { messages } from "@/bot/messages";
import { findActiveSession } from "@/entities/session";
import { acceptFile } from "@/features/intake";
import { downloadTelegramFile } from "@/bot/lib/download";
import { userMessageFor } from "@/bot/lib/reply";
import { flushPendingTextPrompt, sendAcceptPrompt } from "./prompts";
import { processAudio } from "./audio";

export function registerDocumentHandler(bot: Bot): void {
  bot.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    const env = getEnv();
    const session = findActiveSession(ctx.chat.id);
    if (!session) {
      await ctx.reply(messages.noSession());
      return;
    }
    if (session.status !== "collecting") {
      await ctx.reply(messages.processing());
      return;
    }
    await flushPendingTextPrompt(bot, session);

    // Аудио, присланное как документ, идёт через аудио-конвейер
    if (doc.mime_type?.startsWith("audio/")) {
      await processAudio(bot, ctx, session, {
        kind: "audio",
        fileId: doc.file_id,
        durationSec: undefined,
        fileSize: doc.file_size,
        fileName: doc.file_name ?? `audio-${ctx.message.message_id}`,
        mime: doc.mime_type,
        label: doc.file_name ?? "аудио",
      });
      return;
    }

    const sizeMb = doc.file_size ? doc.file_size / (1024 * 1024) : 0;
    if (doc.file_size && doc.file_size > env.MAX_FILE_MB * 1024 * 1024) {
      await ctx.reply(userMessageFor(new FileTooLargeError(sizeMb, env.MAX_FILE_MB)));
      return;
    }

    try {
      const file = await ctx.api.getFile(doc.file_id);
      const buffer = await downloadTelegramFile(env.TELEGRAM_BOT_TOKEN, file.file_path ?? "");
      // Подпись к файлу — отдельный текстовый элемент перед файлом
      await acceptFile(session, { buffer, fileName: doc.file_name, mime: doc.mime_type }, {
        caption: ctx.message.caption,
      });
      await sendAcceptPrompt(bot, session);
    } catch (e) {
      await ctx.reply(userMessageFor(e));
    }
  });
}
