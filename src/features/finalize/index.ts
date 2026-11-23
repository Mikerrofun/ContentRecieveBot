import { getEnv } from "@/shared/config/env";
import { clearSession, findActiveSession } from "@/entities/session";
import type { SessionItem } from "@/entities/session";
import type { CleanupStats } from "@/shared/lib/types";
import { runCleanup } from "@/core/cleanup";
import { autofix } from "@/core/autofix";
import { validate } from "@/core/validate";
import {
  buildReport,
  renderReport,
  type AudioMeta,
  type FinalizeItemResult,
} from "@/features/report";
import { llmValidate, llmFailedResult, type LlmValidateResult } from "@/features/llm-validate";
import type { OutputSink } from "@/features/sink";
import { buildTranscriptFile } from "@/features/transcript-file";
import { saveMaterial } from "@/entities/material";
import { logger } from "@/shared/lib/logger";
import type {
  FinalizeHooks,
  FinalizeOutcome,
  FinalizeStageKey,
  FinalizeStageStatus,
} from "./types";

export type {
  FinalizeHooks,
  FinalizeOutcome,
  FinalizeStageKey,
  FinalizeStageStatus,
  FinalizeStageUpdate,
} from "./types";

/** Промежуток одного элемента между этапом «мусор» и «автопочинка». */
interface CleanedItem {
  item: SessionItem;
  cleanedText: string;
  cleanedStats: CleanupStats;
  warnings: string[];
}

const STAGE_LABELS: Record<FinalizeStageKey, string> = {
  cleanup: "Очистка мусора",
  autofix: "Автопочинка",
  validate: "Валидация текста",
  llm: "LLM-чистка",
  db: "Запись в БД",
};

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
 * Финализация по именованным этапам: очистка мусора → автопочинка →
 * валидация → LLM-чистка → запись в БД. Каждый этап сообщает прогресс через
 * hooks.onStage; следующий этап получает текст предыдущего. Сессия очищается
 * только при успехе.
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

  session.status = "processing";

  const emit = async (key: FinalizeStageKey, status: FinalizeStageStatus): Promise<void> => {
    try {
      await hooks.onStage?.({ key, status, label: STAGE_LABELS[key] });
    } catch {
      // Прогресс не должен ронять финализацию.
    }
  };

  try {
    await hooks.onStarted?.();

    // --- Этап 1: очистка мусора ---
    await emit("cleanup", "running");
    const cleaned: CleanedItem[] = session.items.map((item) => {
      const joinHardWraps = joinHardWrapsFor(env, item.meta.source);
      const res = runCleanup(item.rawText, { joinHardWraps, maxRemovedRatio: env.MAX_REMOVED_RATIO });
      return { item, cleanedText: res.text, cleanedStats: res.stats, warnings: res.warnings };
    });
    await emit("cleanup", "done");

    // --- Этап 2: автопочинка ---
    await emit("autofix", "running");
    const results: FinalizeItemResult[] = cleaned.map((c) => {
      const fixed = autofix(c.cleanedText, {
        joinHardWraps: joinHardWrapsFor(env, c.item.meta.source),
        maxRemovedRatio: env.MAX_REMOVED_RATIO,
      });

      const stats: CleanupStats = {
        mechanical: {},
        "file-artifacts": {},
        defects: {},
        speech: {},
      };
      addStats(stats, c.cleanedStats);
      addStats(stats, fixed.stats);

      return {
        item: c.item,
        cleanedText: fixed.text,
        charsBefore: c.item.rawText.length,
        charsAfter: fixed.text.length,
        stats,
        autofixPasses: fixed.passes,
        validation: fixed.validation,
        warnings: [...c.warnings, ...fixed.warnings],
      };
    });
    await emit("autofix", "done");

    const totalBefore = session.items.reduce((n, i) => n + i.rawText.length, 0);
    let combined = results.map((r) => r.cleanedText).join("\n\n");

    // --- Этап 3: валидация ---
    await emit("validate", "running");
    let totalRatio = totalBefore > 0 ? 1 - combined.length / totalBefore : 0;
    let validation = validate(combined, {
      removedRatio: totalRatio,
      maxRemovedRatio: env.MAX_REMOVED_RATIO,
    });
    await emit("validate", "done");

    // --- Этап 4: LLM-чистка (опционально) ---
    // Сбой LLM не роняет финализацию: текст остаётся после функций.
    let llmResult: LlmValidateResult | null = null;
    if (env.LLM_VALIDATION === "on") {
      await emit("llm", "running");
      try {
        llmResult = await llmValidate(combined);
        if (llmResult.status === "done") {
          combined = llmResult.text;
          totalRatio = totalBefore > 0 ? 1 - combined.length / totalBefore : 0;
          validation = validate(combined, {
            removedRatio: totalRatio,
            maxRemovedRatio: env.MAX_REMOVED_RATIO,
          });
          await emit("llm", "done");
        } else {
          logger.warn("llm validation failed", { chatId, reason: llmResult.error });
          await emit("llm", "failed");
        }
      } catch (e) {
        const reason = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        logger.error("llm validation crashed", { chatId, error: reason });
        llmResult = llmFailedResult(combined, reason);
        await emit("llm", "failed");
      }
    }

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

    // --- Этап 5: запись в БД (до выдачи отчёта: юзер видит её статус) ---
    await emit("db", "running");
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
      llmStatus: llmResult?.status ?? null,
      llmModel: llmResult?.primaryModel ?? null,
      llmInputTokens: llmResult?.usage.inputTokens ?? 0,
      llmOutputTokens: llmResult?.usage.outputTokens ?? 0,
      llmCostUsd: llmResult?.usage.costUsd ?? 0,
    });
    await emit("db", db.ok ? "done" : "failed");

    const sections = buildReport({
      createdAt: session.createdAt,
      items: results,
      combinedText: combined,
      validation,
      audio,
      db,
      llm: llmResult,
    });

    // Файл с транскриптом отправляется всегда, даже при сбое БД:
    // юзер должен получить текст независимо от статуса записи.
    const transcriptFile = buildTranscriptFile(combined, session.createdAt);

    await sink.deliver({ chatId, report: renderReport(sections), transcriptFile });

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