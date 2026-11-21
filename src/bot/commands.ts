import type { Bot } from "grammy";
import { messages } from "@/bot/messages";
import { cancelConfirmKeyboard } from "@/bot/keyboards";
import {
  clearSession,
  createSession,
  findActiveSession,
} from "@/services/session";
import { enqueueTask } from "@/services/queue";
import { finalizeSession } from "@/services/finalize";

export function registerCommands(bot: Bot): void {
  bot.command(["start", "help"], (ctx) => ctx.reply(messages.help()));

  bot.command(["StartProcess", "startprocess"], (ctx) => {
    const session = findActiveSession(ctx.chat.id);
    if (session) {
      void ctx.reply(messages.sessionAlreadyActive());
      return;
    }
    createSession(ctx.chat.id);
    void ctx.reply(messages.sessionStarted());
  });

  bot.command("done", (ctx) => {
    const session = findActiveSession(ctx.chat.id);
    if (!session || session.items.length === 0) {
      void ctx.reply(messages.nothingToLoad());
      return;
    }
    enqueueTask("finalize", () => finalizeSession(bot, ctx.chat.id));
  });

  bot.command("cancel", (ctx) => {
    const session = findActiveSession(ctx.chat.id);
    if (!session) {
      void ctx.reply(messages.nothingToLoad());
      return;
    }
    if (session.items.length > 0) {
      // С подтверждением, если в сессии уже есть материал
      void ctx.reply(messages.cancelConfirm(session.items.length), {
        reply_markup: cancelConfirmKeyboard(),
      });
      return;
    }
    clearSession(ctx.chat.id);
    void ctx.reply(messages.cancelled());
  });

  bot.command("status", (ctx) => {
    const session = findActiveSession(ctx.chat.id);
    if (!session) {
      void ctx.reply(messages.noSession());
      return;
    }
    void ctx.reply(messages.status(session));
  });
}
