import type { CleanupResult } from "@/shared/lib/types";
import { emptyStats, runRulesById, REGISTRY, bump, type CleanupContext } from "./rules";

export interface CleanupOptions {
  joinHardWraps: boolean;
  maxRemovedRatio: number;
}

/**
 * Детерминированная очистка: правила со счётчиками, без LLM.
 * Удаляется только мусор, смысловое содержимое не трогается.
 */
export function runCleanup(text: string, opts: CleanupOptions): CleanupResult {
  const ctx: CleanupContext = { stats: emptyStats(), joinHardWraps: opts.joinHardWraps };
  let out = text;
  for (const rule of REGISTRY) {
    const res = rule.run(out, ctx);
    if (res.count > 0) {
      bump(ctx, rule.category, rule.id, res.count);
    }
    out = res.text;
  }

  const rawLength = text.length;
  const removedRatio = rawLength > 0 ? 1 - out.length / rawLength : 0;
  const warnings: string[] = [];
  if (rawLength > 0 && removedRatio > opts.maxRemovedRatio) {
    warnings.push(
      `удалено аномально много (${Math.round(removedRatio * 100)}% символов), проверь результат`
    );
  }

  return { text: out, stats: ctx.stats, removedRatio, warnings };
}

export { runRulesById, REGISTRY, emptyStats };
export type { CleanupContext, Rule, RuleResult } from "./rules";
