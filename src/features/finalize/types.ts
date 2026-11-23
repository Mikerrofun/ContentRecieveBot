/** Типы финализации. Оркестрация — в index.ts. */

/** Итог финализации — презентация решает, что показать пользователю. */
export type FinalizeOutcome = "done" | "empty" | "busy" | "db-failed" | "failed";

/** Ключ этапа обработки. */
export type FinalizeStageKey = "cleanup" | "autofix" | "validate" | "llm" | "db";

/** Статус этапа обработки. */
export type FinalizeStageStatus = "running" | "done" | "failed";

/** Обновление прогресса по этапу обработки. */
export interface FinalizeStageUpdate {
  key: FinalizeStageKey;
  status: FinalizeStageStatus;
  label: string;
}

/**
 * Хуки для сообщений пользователю. Слой features не знает про Telegram
 * и тексты бота — их подставляет слой bot.
 */
export interface FinalizeHooks {
  onStarted?: () => Promise<unknown>;
  /** Вызывается на старте и завершении каждого этапа обработки. */
  onStage?: (update: FinalizeStageUpdate) => Promise<unknown>;
  onFailed?: () => Promise<unknown>;
}