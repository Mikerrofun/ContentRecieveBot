import type { CleanupStats } from "@/shared/lib/types";

/** Сущность «запись материала»: валидированный текст одной сессии в БД. */

/** Что пишем: одна строка на финализацию (весь склеенный текст сессии). */
export interface MaterialRecordInput {
  text: string;
  charsBefore: number;
  charsAfter: number;
  itemsCount: number;
  audioCount: number;
  audioDurationSec: number;
  validationOk: boolean;
  warnings: string[];
  stats: CleanupStats;
}

export interface MaterialRecord {
  id: string;
  /** ISO-дата записи из БД. */
  createdAt: string;
}

export type MaterialSaveResult =
  | { ok: true; record: MaterialRecord }
  | { ok: false; error: string };
