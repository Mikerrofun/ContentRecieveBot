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
  /** Сигнал отмены/таймаута на попытку (создаётся в withRetry). */
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  text: string;
  model: string;
  usage: TokenUsage;
}