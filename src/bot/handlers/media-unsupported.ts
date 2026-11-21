import type { Bot } from "grammy";
import { messages } from "@/bot/messages";

export function registerMediaUnsupportedHandler(bot: Bot): void {
  bot.on("message:video_note", (ctx) => ctx.reply(messages.circleUnsupported()));
  bot.on("message:video", (ctx) => ctx.reply(messages.videoUnsupported()));
}
