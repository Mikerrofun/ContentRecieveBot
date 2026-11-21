import type { Bot } from "grammy";
import { messages } from "@/bot/messages";
import { findActiveSession } from "@/entities/session";
import { acceptText } from "@/features/intake";
import { scheduleAcceptPrompt } from "./prompts";

export function registerTextHandler(bot: Bot): void {
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;
    if (text.startsWith("/")) return; // команды обрабатываются раньше

    const session = findActiveSession(ctx.chat.id);
    if (!session) {
      await ctx.reply(messages.noSession());
      return;
    }
    if (session.status !== "collecting") {
      await ctx.reply(messages.processing());
      return;
    }

    acceptText(session, text);
    scheduleAcceptPrompt(bot, session);
  });
}
