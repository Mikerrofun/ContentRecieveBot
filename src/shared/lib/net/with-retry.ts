import { RETRY_ATTEMPTS, RETRY_BACKOFF_MS } from "./with-retry.config";
import type { WithRetryOptions } from "./with-retry.types";
import { RetryableError } from "./with-retry.types";

export { RetryableError } from "./with-retry.types";
export type { WithRetryOptions } from "./with-retry.types";

/** HTTP-статусы, при которых запрос стоит повторить. */
/** 408/429/5xx — прочие 4xx пробрасываются сразу. */
export function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RetryableError) {
    return error.status === undefined || isRetryableStatus(error.status);
  }
  if (error instanceof TypeError) return true;
  if (typeof error === "object" && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (name === "TimeoutError" || name === "AbortError") return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Сигнал одной попытки: объединяет внешнюю отмену и таймаут. */
function createAttemptSignal(
  external: AbortSignal | undefined,
  timeoutMs: number | undefined
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const onExternal = () => controller.abort();

  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternal, { once: true });
  }

  const timer =
    timeoutMs && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : undefined;

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onExternal);
    },
  };
}


export async function withRetry<T>(
  fn: (attempt: number, signal: AbortSignal) => Promise<T>,
  opts: WithRetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? RETRY_ATTEMPTS);
  const backoff = opts.backoffMs ?? RETRY_BACKOFF_MS;
  const shouldRetry = opts.shouldRetry ?? isRetryableError;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (opts.signal?.aborted) {
      throw opts.signal.reason instanceof Error ? opts.signal.reason : new Error("aborted");
    }

    const { signal, cleanup } = createAttemptSignal(opts.signal, opts.timeoutMs);
    try {
      return await fn(attempt, signal);
    } catch (e) {
      lastError = e;
      if (attempt >= attempts || opts.signal?.aborted || !shouldRetry(e)) break;
      await opts.onAttemptFail?.(attempt);
      const delay = Array.isArray(backoff)
        ? backoff[attempt - 1] ?? backoff[backoff.length - 1]
        : backoff;
      if (delay > 0) await sleep(delay);
    } finally {
      cleanup();
    }
  }

  throw lastError;
}