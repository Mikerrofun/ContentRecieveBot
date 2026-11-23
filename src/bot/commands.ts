import type { Bot } from "grammy";
import { messages } from "@/bot/messages";
import { cancelConfirmKeyboard } from "@/bot/keyboards";
import { clearSession, createSession, findActiveSession } from "@/entities/session";
import { saveUser } from "@/entities/user";
import { enqueueFinalize } from "@/bot/lib/finalize-flow";
import { logger } from "@/shared/lib/logger";

export function registerCommands(bot: Bot): void {
  bot.command("start", async (ctx) => {
    // Записываем пользователя при первом /start (повторные обновляют профиль).
    // Ответ не блокируем — saveUser сам гасит ошибки БД.
    const u = ctx.from;
    if (u) {
      void saveUser({
        telegramId: u.id,
        username: u.username,
        firstName: u.first_name,
        lastName: u.last_name,
        languageCode: u.language_code,
      }).then((res) => {
        if (!res.ok) logger.warn("save user failed", { error: res.error });
      });
    }
    await ctx.reply(messages.help());
  });

  bot.command("help", (ctx) => ctx.reply(messages.help()));

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
    enqueueFinalize(bot, ctx.chat.id);
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
