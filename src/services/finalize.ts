import type { Bot } from "grammy";
import type { AudioMeta, CleanupStats, FinalizeItemResult } from "@/shared/types";
import { getEnv } from "@/config/env";
import { messages } from "@/bot/messages";
import { clearSession, findActiveSession } from "@/services/session";
import { runCleanup, optionalLlmPass } from "@/core/cleanup";
import { autofix } from "@/core/autofix";
import { validate } from "@/core/validate";
import { buildReport, renderReport } from "@/services/report";
import { createSink } from "@/services/sink";
import { LlmNotImplementedError } from "@/shared/errors";
import { logger } from "@/shared/logger";

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
 * всего текста → отчёт → выдача. Сессия очищается только при успехе.
 */
export async function finalizeSession(bot: Bot, chatId: number): Promise<void> {
  const env = getEnv();
  const session = findActiveSession(chatId);
  if (!session || session.items.length === 0) {
    await bot.api.sendMessage(chatId, messages.nothingToLoad());
    return;
  }

  if (env.CLEANUP_LLM === "on" && optionalLlmPass === null) {
    await bot.api.sendMessage(chatId, new LlmNotImplementedError().userMessage);
    return;
  }

  session.status = "processing";
  try {
    await bot.api.sendMessage(chatId, messages.finalizing());

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
    const totalRatio =
      session.items.reduce((n, i) => n + i.rawText.length, 0) > 0
        ? 1 - combined.length / session.items.reduce((n, i) => n + i.rawText.length, 0)
        : 0;
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

    const sections = buildReport({
      createdAt: session.createdAt,
      items: results,
      combinedText: combined,
      validation,
      audio,
    });

    const pad = (n: number) => String(n).padStart(2, "0");
    const d = new Date();
    const fileBaseName = `result-${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}-${pad(d.getHours())}-${pad(d.getMinutes())}`;

    const sink = createSink(bot, env);
    await sink.deliver({ chatId, text: combined, report: renderReport(sections), fileBaseName });

    clearSession(chatId);
    logger.info("finalize done", { chatId, items: results.length, chars: combined.length });
  } catch (e) {
    session.status = "collecting";
    logger.error("finalize failed", {
      chatId,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    await bot.api.sendMessage(chatId, messages.genericError()).catch(() => undefined);
    throw e;
  }
}
