import type { CleanupCategory, CleanupStats } from "@/shared/types";
import { mechanicalRules, finalNormalizationRule } from "./mechanical";
import { fileArtifactRules } from "./file-artifacts";
import { defectRules } from "./defects";
import { speechRules } from "./speech";

export interface CleanupContext {
  stats: CleanupStats;
  /** JOIN_HARD_WRAPS: склеивать жёсткие переносы внутри абзаца. */
  joinHardWraps: boolean;
}

export interface RuleResult {
  text: string;
  count: number;
}

export interface Rule {
  id: string;
  category: CleanupCategory;
  run(text: string, ctx: CleanupContext): RuleResult;
}

export function emptyStats(): CleanupStats {
  return { mechanical: {}, "file-artifacts": {}, defects: {}, speech: {} };
}

export function bump(ctx: CleanupContext, category: CleanupCategory, id: string, count: number): void {
  if (count <= 0) return;
  ctx.stats[category][id] = (ctx.stats[category][id] ?? 0) + count;
}

export const ok = (text: string): RuleResult => ({ text, count: 0 });

/**
 * Реестр правил. Порядок прогона: механика → артефакты файлов → точечные
 * дефекты → речь → финальная нормализация пробелов.
 */
export const REGISTRY: Rule[] = [
  ...mechanicalRules,
  ...fileArtifactRules,
  ...defectRules,
  ...speechRules,
  finalNormalizationRule,
];

export const RULES_BY_ID = new Map(REGISTRY.map((r) => [r.id, r]));

export { finalNormalizationRule } from "./mechanical";

/** Прогон подмножества правил (используется автопочинкой). */
export function runRulesById(text: string, ids: string[], ctx: CleanupContext): string {
  let out = text;
  for (const id of ids) {
    const rule = RULES_BY_ID.get(id);
    if (!rule) continue;
    const res = rule.run(out, ctx);
    bump(ctx, rule.category, rule.id, res.count);
    out = res.text;
  }
  return out;
}
