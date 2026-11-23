/** Типы клиента OpenRouter. Логика — в openrouter.ts. */

export interface TokenUsage {
  input: number;
  output: number;
}

export interface ChatCompletionInput {
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Управление «размышлениями» reasoning-модели (OpenRouter reasoning.effort). */
  reasoning?: { effort: "minimal" | "low" | "medium" | "high" };
  /** Хук учёта токенов: вызывается на каждый ответ (в т.ч. с пустым content). */
  onUsage?: (model: string, usage: TokenUsage) => void;
  /** Сигнал отмены/таймаута на попытку (создаётся в withRetry). */
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  usage: TokenUsage;
}