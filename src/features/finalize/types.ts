/** Типы финализации. Оркестрация — в index.ts. */

/** Итог финализации — презентация решает, что показать пользователю. */
export type FinalizeOutcome =
  | "done"
  | "empty"
  | "busy"
  | "llm-not-implemented"
  | "db-failed"
  | "failed";

/**
 * Хуки для сообщений пользователю. Слой features не знает про Telegram
 * и тексты бота — их подставляет слой bot.
 */
export interface FinalizeHooks {
  onStarted?: () => Promise<unknown>;
  onFailed?: () => Promise<unknown>;
}
