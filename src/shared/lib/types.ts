/** Общие типы домена очистки/валидации. Модели сессии — в entities/session. */

export type FileSource = "pdf" | "docx" | "md" | "txt";

export type CleanupCategory = "mechanical" | "file-artifacts" | "defects" | "speech";

/** stats[category][ruleId] = число срабатываний */
export type CleanupStats = Record<CleanupCategory, Record<string, number>>;

export interface CleanupResult {
  text: string;
  stats: CleanupStats;
  /** Доля удалённых символов (0..1) относительно исходника. */
  removedRatio: number;
  warnings: string[];
}

export interface Violation {
  criterion: string;
  count: number;
  /** До 3 коротких примеров (без длинных кусков текста). */
  samples: string[];
  fixable: boolean;
  severity: "error" | "warn";
}

export interface ValidationResult {
  ok: boolean;
  violations: Violation[];
}
