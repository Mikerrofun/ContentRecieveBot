import type { CleanupStats, ValidationResult } from "@/shared/lib/types";
import type { SessionItem } from "@/entities/session";
import type { MaterialSaveResult } from "@/entities/material";

/** Типы отчёта. Сборка и рендер — в index.ts. */

/** DTO финализации — общий для features/finalize и features/report. */
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

export interface AudioMeta {
  count: number;
  totalDurationSec: number;
  provider?: string;
  model?: string;
}

export interface ReportSection {
  title?: string;
  body: string;
}

export interface ReportInput {
  createdAt: number;
  items: FinalizeItemResult[];
  combinedText: string;
  validation: ValidationResult;
  audio: AudioMeta;
  /** Результат записи в БД — секция «Запись в БД» отчёта. */
  db: MaterialSaveResult;
}
