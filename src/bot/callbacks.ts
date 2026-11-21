import type { Bot } from "grammy";
import { messages } from "@/bot/messages";
import { CALLBACK, cancelConfirmKeyboard } from "@/bot/keyboards";
import { clearSession, findActiveSession } from "@/entities/session";
import { enqueueFinalize } from "@/bot/lib/finalize-flow";
import { logger } from "@/shared/lib/logger";

export function registerCallbacks(bot: Bot): void {
  bot.on("callback_query:data", async (ctx) => {
    const data = ctx.callbackQuery.data;
    const chatId = ctx.callbackQuery.message?.chat.id ?? ctx.chat?.id;
    if (!chatId) {
      await ctx.answerCallbackQuery();
      return;
    }

    const session = findActiveSession(chatId);

    try {
      switch (data) {
        case CALLBACK.more: {
          if (!session) {
            await ctx.reply(messages.staleSession());
            break;
          }
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(messages.waitingMore());
          break;
        }
        case CALLBACK.finalize: {
          if (!session || session.items.length === 0) {
            await ctx.reply(messages.staleSession());
            break;
          }
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          enqueueFinalize(bot, chatId);
          break;
        }
        case CALLBACK.cancel: {
          if (!session) {
            await ctx.reply(messages.staleSession());
            break;
          }
          if (session.items.length > 0) {
            await ctx.reply(messages.cancelConfirm(session.items.length), {
              reply_markup: cancelConfirmKeyboard(),
            });
            break;
          }
          clearSession(chatId);
          await ctx.editMessageReplyMarkup({ reply_markup: undefined });
          await ctx.reply(messages.cancelled());
          break;
        }
        case CALLBACK.cancelYes: {
          clearSession(chatId);
          await ctx.reply(messages.cancelled());
          break;
        }
        case CALLBACK.cancelNo: {
          await ctx.reply(messages.cancelKept());
          break;
        }
        default:
          logger.warn("unknown callback", { data });
      }
    } finally {
      await ctx.answerCallbackQuery();
    }
  });
}
