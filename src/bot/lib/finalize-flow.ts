import type { Bot } from "grammy";
import { messages, renderStages } from "@/bot/messages";
import { enqueueTask } from "@/features/queue";
import { runFinalization } from "@/features/finalize";
import type { FinalizeStageKey, FinalizeStageUpdate } from "@/features/finalize";
import { createSink } from "@/bot/lib/sink";

/** Порядок этапов для списка прогресса. */
const STAGE_ORDER: FinalizeStageKey[] = ["cleanup", "autofix", "validate", "llm", "db"];

/**
 * Финализация как задача очереди: вся презентация (тексты, отправка) — здесь,
 * оркестрация — в features/finalize.
 */
export function enqueueFinalize(bot: Bot, chatId: number): void {
  enqueueTask("finalize", async () => {
    const sink = createSink(bot);
    let statusMessageId: number | undefined;
    const stages: Partial<Record<FinalizeStageKey, FinalizeStageUpdate>> = {};

    try {
      const outcome = await runFinalization(chatId, sink, {
        onStarted: async () => {
          const msg = await bot.api.sendMessage(chatId, messages.finalizing());
          statusMessageId = msg.message_id;
        },
        onStage: async (update) => {
          stages[update.key] = update;
          if (statusMessageId === undefined) return;
          const ordered = STAGE_ORDER.filter((k) => stages[k]).map((k) => {
            const u = stages[k] as FinalizeStageUpdate;
            return { label: u.label, status: u.status };
          });
          await bot.api
            .editMessageText(chatId, statusMessageId, renderStages(ordered))
            .catch(() => undefined);
        },
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
      }
    } finally {
      // Убираем «Обрабатываю…» после завершения, чтобы не висело в чате.
      if (statusMessageId !== undefined) {
        await bot.api.deleteMessage(chatId, statusMessageId).catch(() => undefined);
      }
    }
  });
}