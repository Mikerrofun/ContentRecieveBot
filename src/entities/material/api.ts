import { getDatabase } from "@/shared/api/supabase";
import type { MaterialRecordInput, MaterialSaveResult } from "./types";

/**
 * Записывает валидированный текст сессии в таблицу materials.
 * Ошибки не бросаются — результат проверяется вызывающей стороной
 * (финализация должна успеть показать отчёт даже при сбое БД).
 */
export async function saveMaterial(input: MaterialRecordInput): Promise<MaterialSaveResult> {
  try {
    const db = getDatabase();
    
    const query = `
      INSERT INTO materials (
        text, chars_before, chars_after, items_count, audio_count, 
        audio_duration_sec, validation_ok, warnings, stats,
        llm_status, llm_model, llm_input_tokens, llm_output_tokens, llm_cost_usd
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, created_at
    `;

    const values = [
      input.text,
      input.charsBefore,
      input.charsAfter,
      input.itemsCount,
      input.audioCount,
      input.audioDurationSec,
      input.validationOk,
      input.warnings,
      JSON.stringify(input.stats),
      input.llmStatus ?? null,
      input.llmModel ?? null,
      input.llmInputTokens ?? 0,
      input.llmOutputTokens ?? 0,
      input.llmCostUsd ?? 0,
    ];

    const result = await db.query(query, values);
    const row = result.rows[0];

    return { 
      ok: true, 
      record: { 
        id: row.id, 
        createdAt: row.created_at 
      } 
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
