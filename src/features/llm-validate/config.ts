/** Внутренние константы LLM-прохода. Значения, tunable через env, — в shared/config/env.ts. */

export const PRIMARY_MODEL = "z-ai/glm-5.3-flash";
export const FALLBACK_MODEL = "qwen/qwen3.7-flash";

/** Основная модель: 3 попытки с фиксированной паузой. */
export const PRIMARY_ATTEMPTS = 3;
export const PRIMARY_BACKOFF_MS = 400;

/** Глобальные ошибки (неверный ключ, нет кредитов): Qwen упадёт так же — валим весь прогон. */
export const GLOBAL_ERROR_STATUSES: ReadonlySet<number> = new Set([401, 402]);

/** Сколько символов соседнего чанка даём модели как read-only контекст. */
export const LLM_CONTEXT_CHARS = 200;

/**
 * Приблизительная цена за 1M токенов (USD). Значения-заглушки: при необходимости
 * уточняются под актуальный тариф OpenRouter, на поведение не влияют.
 */
export const PRICE_PER_1M: Record<string, { input: number; output: number }> = {
  [PRIMARY_MODEL]: { input: 0.1, output: 0.4 },
  [FALLBACK_MODEL]: { input: 0.05, output: 0.2 },
};