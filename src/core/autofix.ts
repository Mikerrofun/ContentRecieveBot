import type { CleanupResult, ValidationResult } from "@/shared/lib/types";
import { emptyStats, runRulesById, finalNormalizationRule, type CleanupContext } from "./cleanup/rules";
import type { CleanupOptions } from "./cleanup";
import { validate, type ValidateOptions } from "./validate";

/**
 * Соответствие критериев валидатора правилам очистки. Хранится в одном месте.
 */
const CRITERION_RULES: Record<string, string[]> = {
  V1: ["m-html-tags"],
  V2: ["m-whitespace"],
  V3: ["m-whitespace"],
  V4: ["m-blank-lines"],
  V5: ["m-whitespace"],
  V6: ["m-replacement-char"],
  V7: ["m-invisible"],
  V8: ["d-homoglyphs", "d-glue"],
  V9: ["d-hanging-prepositions"],
  V10: ["d-punct-space", "d-slash-space"],
  V11: ["s-fillers-always"],
  V12: ["s-fillers-delimited"],
  V13: ["d-repeated-words"],
  V14: ["d-truncated", "d-stutter"],
  V15: ["f-page-numbers", "d-empty-markers"],
  V19: ["d-false-start-dash", "d-false-start-comma", "d-false-start-fragment"],
  V20: ["s-elongated"],
};

const MAX_PASSES = 3;

export interface AutofixResult {
  text: string;
  stats: CleanupResult["stats"];
  removedRatio: number;
  warnings: string[];
  passes: number;
  validation: ValidationResult;
}

/**
 * Цикл: validate → точечная починка только нарушенных критериев → validate.
 * После MAX_PASSES результат всё равно выдаётся — оставшиеся нарушения
 * попадают в отчёт, бот не падает.
 */
export function autofix(text: string, opts: CleanupOptions & ValidateOptions): AutofixResult {
  const ctx: CleanupContext = { stats: emptyStats(), joinHardWraps: opts.joinHardWraps };
  let current = text;
  let validation = validate(current, opts);
  let passes = 0;

  while (!validation.ok && passes < MAX_PASSES) {
    const ruleIds = new Set<string>();
    for (const v of validation.violations) {
      if (v.severity !== "error" || !v.fixable) continue;
      for (const id of CRITERION_RULES[v.criterion] ?? []) ruleIds.add(id);
    }
    if (ruleIds.size === 0) break;

    current = runRulesById(current, [...ruleIds], ctx);
    const norm = finalNormalizationRule.run(current, ctx);
    current = norm.text;

    passes++;
    validation = validate(current, opts);
  }

  const rawLength = text.length;
  const removedRatio = rawLength > 0 ? 1 - current.length / rawLength : 0;
  const warnings: string[] = [];
  if (rawLength > 0 && removedRatio > (opts.maxRemovedRatio ?? 0.4)) {
    warnings.push(
      `удалено аномально много (${Math.round(removedRatio * 100)}% символов), проверь результат`
    );
  }

  return {
    text: current,
    stats: ctx.stats,
    removedRatio,
    warnings,
    passes,
    validation,
  };
}
