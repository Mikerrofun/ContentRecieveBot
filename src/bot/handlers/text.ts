import type { Bot } from "grammy";
import { messages } from "@/bot/messages";
import { appendTextToLast, findActiveSession } from "@/services/session";
import { scheduleAcceptPrompt } from "./prompts";

export function registerTextHandler(bot: Bot): void {
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // команды обрабатываются раньше

    const session = findActiveSession(ctx.chat.id);
    if (!session || session.status !== "collecting") {
      await ctx.reply(messages.noSession());
      return;
    }

    appendTextToLast(session, text);
    scheduleAcceptPrompt(bot, session);
  });
}
