import PQueue from "p-queue";
import { logger } from "@/shared/lib/logger";

/**
 * In-memory очередь, конкурентность 1 (один пользователь, предсказуемый
 * порядок). Webhook отвечает Telegram быстро, работа выполняется из очереди.
 * Перезапуск процесса теряет очередь и сессию — персистентности нет (БД нет).
 */
const g = globalThis as unknown as { __botQueue?: PQueue };

export function getQueue(): PQueue {
  g.__botQueue ??= new PQueue({ concurrency: 1 });
  return g.__botQueue;
}

export function enqueueTask(name: string, fn: () => Promise<void>): void {
  void getQueue().add(async () => {
    try {
      await fn();
    } catch (e) {
      logger.error("queue task failed", {
        name,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      });
    }
  });
}

/** Дедупликация апдейтов по update_id (окно последних 200). */
const gSeen = globalThis as unknown as { __seenUpdates?: Set<number> };

export function isDuplicateUpdate(updateId: number): boolean {
  const seen = (gSeen.__seenUpdates ??= new Set());
  if (seen.has(updateId)) return true;
  seen.add(updateId);
  if (seen.size > 200) {
    const oldest = seen.values().next().value;
    if (oldest !== undefined) seen.delete(oldest);
  }
  return false;
}
