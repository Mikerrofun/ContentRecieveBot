import { getSupabase } from "@/shared/api/supabase";
import type { MaterialRecordInput, MaterialSaveResult } from "./types";

/**
 * Записывает валидированный текст сессии в таблицу materials.
 * Ошибки не бросаются — результат проверяется вызывающей стороной
 * (финализация должна успеть показать отчёт даже при сбое БД).
 */
export async function saveMaterial(input: MaterialRecordInput): Promise<MaterialSaveResult> {
  try {
    const { data, error } = await getSupabase()
      .from("materials")
      .insert({
        text: input.text,
        chars_before: input.charsBefore,
        chars_after: input.charsAfter,
        items_count: input.itemsCount,
        audio_count: input.audioCount,
        audio_duration_sec: input.audioDurationSec,
        validation_ok: input.validationOk,
        warnings: input.warnings,
        stats: input.stats,
      })
      .select("id, created_at")
      .single();

    if (error) return { ok: false, error: error.message };
    return { ok: true, record: { id: data.id, createdAt: data.created_at } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
