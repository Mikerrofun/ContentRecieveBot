export type ItemKind = "text" | "file" | "voice" | "audio";

export type FileSource = "pdf" | "docx" | "md" | "txt";

export interface SessionItemMeta {
  fileName?: string;
  durationSec?: number;
  /** Источник текста — влияет на флаг JOIN_HARD_WRAPS при очистке. */
  source?: FileSource | "voice" | "audio" | "text";
  provider?: string;
  model?: string;
}

export interface SessionItem {
  id: string;
  kind: ItemKind;
  label: string;
  rawText: string;
  meta: SessionItemMeta;
}

export type SessionStatus = "collecting" | "processing";

export interface Session {
  chatId: number;
  status: SessionStatus;
  items: SessionItem[];
  createdAt: number;
  lastActivityAt: number;
  /** Текст принят, но окно склейки ещё не закрылось — промпт не отправлен. */
  pendingTextPrompt?: boolean;
}

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

export interface AudioMeta {
  count: number;
  totalDurationSec: number;
  provider?: string;
  model?: string;
}

export interface FinalizeItemResult {
  item: SessionItem;
  cleanedText: string;
  charsBefore: number;
  charsAfter: number;
  stats: CleanupStats;
  autofixPasses: number;
  validation: ValidationResult;
  warnings: string[];
}
