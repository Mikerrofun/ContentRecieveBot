import type { Bot } from "grammy";
import { LlmNotImplementedError } from "@/shared/lib/errors";
import { messages } from "@/bot/messages";
import { enqueueTask } from "@/features/queue";
import { runFinalization } from "@/features/finalize";
import { createSink } from "@/bot/lib/sink";

/**
 * Финализация как задача очереди: вся презентация (тексты, отправка) — здесь,
 * оркестрация — в features/finalize.
 */
export function enqueueFinalize(bot: Bot, chatId: number): void {
  enqueueTask("finalize", async () => {
    const sink = createSink(bot);
    const outcome = await runFinalization(chatId, sink, {
      onStarted: () => bot.api.sendMessage(chatId, messages.finalizing()),
      onFailed: () => bot.api.sendMessage(chatId, messages.genericError()),
    });

    switch (outcome) {
      case "done":
      case "busy":
      case "failed": // onFailed уже отправил сообщение
        break;
      case "empty":
        await bot.api.sendMessage(chatId, messages.nothingToLoad());
        break;
      case "db-failed":
        await bot.api.sendMessage(chatId, messages.dbFailed());
        break;
      case "llm-not-implemented":
        await bot.api.sendMessage(chatId, new LlmNotImplementedError().userMessage);
        break;
    }
  });
}
