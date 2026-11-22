import { getEnv } from "@/shared/config/env";
import { clearSession, findActiveSession } from "@/entities/session";
import type { CleanupStats } from "@/shared/lib/types";
import { runCleanup, optionalLlmPass } from "@/core/cleanup";
import { autofix } from "@/core/autofix";
import { validate } from "@/core/validate";
import {
  buildReport,
  renderReport,
  type AudioMeta,
  type FinalizeItemResult,
} from "@/features/report";
import type { OutputSink } from "@/features/sink";
import { saveMaterial } from "@/entities/material";
import { LlmNotImplementedError } from "@/shared/lib/errors";
import { logger } from "@/shared/lib/logger";
import type { FinalizeHooks, FinalizeOutcome } from "./types";

export type { FinalizeHooks, FinalizeOutcome } from "./types";

function addStats(target: CleanupStats, source: CleanupStats): void {
  for (const category of Object.keys(source) as (keyof CleanupStats)[]) {
    for (const [id, count] of Object.entries(source[category])) {
      target[category][id] = (target[category][id] ?? 0) + count;
    }
  }
}

function joinHardWrapsFor(env: ReturnType<typeof getEnv>, source?: string): boolean {
  if (env.JOIN_HARD_WRAPS === "all") return true;
  if (env.JOIN_HARD_WRAPS === "off") return false;
  return source === "pdf"; // режим "pdf" — только для PDF
}

/**
 * Финализация: очистка каждого элемента → автопочинка → склейка → валидация
 * всего текста → отчёт → выдача через sink. Сессия очищается только при успехе.
 */
export async function runFinalization(
  chatId: number,
  sink: OutputSink,
  hooks: FinalizeHooks = {}
): Promise<FinalizeOutcome> {
  const env = getEnv();
  const session = findActiveSession(chatId);
  if (!session || session.items.length === 0) return "empty";

  // Защита от двойного запуска (/done + кнопка, повторный /done)
  if (session.status === "processing") return "busy";

  if (env.CLEANUP_LLM === "on" && optionalLlmPass === null) return "llm-not-implemented";

  session.status = "processing";
  try {
    await hooks.onStarted?.();

    const results: FinalizeItemResult[] = [];
    for (const item of session.items) {
      const joinHardWraps = joinHardWrapsFor(env, item.meta.source);
      const opts = { joinHardWraps, maxRemovedRatio: env.MAX_REMOVED_RATIO };

      const cleaned = runCleanup(item.rawText, opts);
      const fixed = autofix(cleaned.text, opts);

      const stats: CleanupStats = {
        mechanical: {},
        "file-artifacts": {},
        defects: {},
        speech: {},
      };
      addStats(stats, cleaned.stats);
      addStats(stats, fixed.stats);

      results.push({
        item,
        cleanedText: fixed.text,
        charsBefore: item.rawText.length,
        charsAfter: fixed.text.length,
        stats,
        autofixPasses: fixed.passes,
        validation: fixed.validation,
        warnings: [...cleaned.warnings, ...fixed.warnings],
      });
    }

    const combined = results.map((r) => r.cleanedText).join("\n\n");
    const totalBefore = session.items.reduce((n, i) => n + i.rawText.length, 0);
    const totalRatio = totalBefore > 0 ? 1 - combined.length / totalBefore : 0;
    const validation = validate(combined, {
      removedRatio: totalRatio,
      maxRemovedRatio: env.MAX_REMOVED_RATIO,
    });

    const audio: AudioMeta = {
      count: results.filter((r) => r.item.kind === "voice" || r.item.kind === "audio").length,
      totalDurationSec: session.items.reduce((n, i) => n + (i.meta.durationSec ?? 0), 0),
      provider: session.items.find((i) => i.meta.provider)?.meta.provider,
      model: session.items.find((i) => i.meta.model)?.meta.model,
    };

    const totalStats: CleanupStats = {
      mechanical: {},
      "file-artifacts": {},
      defects: {},
      speech: {},
    };
    for (const r of results) addStats(totalStats, r.stats);

    // Запись в БД до выдачи отчёта: юзер должен увидеть её статус.
    const db = await saveMaterial({
      text: combined,
      charsBefore: totalBefore,
      charsAfter: combined.length,
      itemsCount: results.length,
      audioCount: audio.count,
      audioDurationSec: audio.totalDurationSec,
      validationOk: validation.ok,
      warnings: [...new Set(results.flatMap((r) => r.warnings))],
      stats: totalStats,
    });

    const sections = buildReport({
      createdAt: session.createdAt,
      items: results,
      combinedText: combined,
      validation,
      audio,
      db,
    });

    await sink.deliver({ chatId, report: renderReport(sections) });

    if (!db.ok) {
      // Сессия сохранена — юзер может повторить /done без потери материала.
      logger.error("db save failed", { chatId, error: db.error });
      return "db-failed";
    }

    clearSession(chatId);
    logger.info("finalize done", { chatId, items: results.length, chars: combined.length });
    return "done";
  } catch (e) {
    session.status = "collecting";
    logger.error("finalize failed", {
      chatId,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    await hooks.onFailed?.().catch(() => undefined);
    return "failed";
  }
}
