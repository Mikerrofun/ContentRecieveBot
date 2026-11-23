export interface WithRetryOptions {
  /** Сколько попыток максимум (включая первую). */
  attempts?: number;
  /** Пауза перед повтором: одно число (фиксированная) или массив по попыткам. */
  backoffMs?: number | number[];
  /** Внешний сигнал отмены — обрывает весь цикл повторов. */
  signal?: AbortSignal;
  /** Таймаут на одну попытку; реализуется через AbortController. */
  timeoutMs?: number;
  /** Предикат «ошибка временная, стоит повторить». По умолчанию isRetryableError. */
  shouldRetry?: (error: unknown) => boolean;
  /** Хук перед повтором (для сообщения «Повторяю…» и логов). */
  onAttemptFail?: (attempt: number) => void | Promise<void>;
}

/**
 * Ошибка «временного» сбоя с необязательным HTTP-статусом.
 * Статус-less ошибка считается ретраебельной (например, пустой ответ модели).
 */
export class RetryableError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "RetryableError";
    this.status = status;
  }
}