import type { ValidationResult } from "@/shared/lib/types";
import { CRITERIA, type CriterionInput } from "./criteria";

export interface ValidateOptions {
  removedRatio?: number;
  maxRemovedRatio?: number;
}

/** Валидатор читает текст и ничего не меняет. */
export function validate(text: string, opts: ValidateOptions = {}): ValidationResult {
  const input: CriterionInput = {
    text,
    removedRatio: opts.removedRatio,
    maxRemovedRatio: opts.maxRemovedRatio,
  };

  const violations = [];
  for (const criterion of CRITERIA) {
    const res = criterion.check(input);
    if (!res || res.count <= 0) continue;
    violations.push({
      criterion: criterion.id,
      count: res.count,
      samples: res.samples,
      fixable: criterion.fixable,
      severity: criterion.severity,
    });
  }

  const ok = violations.every((v) => v.severity !== "error");
  return { ok, violations };
}

export { CRITERIA };
export type { Criterion, CriterionInput } from "./criteria";
