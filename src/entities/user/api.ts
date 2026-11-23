import { getDatabase } from "@/shared/api/supabase";
import type { TelegramUserProfile, UserSaveResult } from "./types";

/**
 * Записывает пользователя при /start. Первый раз — INSERT, повторно —
 * UPDATE профиля и last_seen_at (без дубликатов). Ошибки не бросаются:
 * /start не должен падать из-за недоступной БД.
 */
export async function saveUser(profile: TelegramUserProfile): Promise<UserSaveResult> {
  try {
    const db = getDatabase();

    const query = `
      INSERT INTO users (telegram_id, username, first_name, last_name, language_code)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (telegram_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        language_code = EXCLUDED.language_code,
        last_seen_at = NOW()
      RETURNING (xmax = 0) AS inserted
    `;

    const values = [
      profile.telegramId,
      profile.username ?? null,
      profile.firstName ?? null,
      profile.lastName ?? null,
      profile.languageCode ?? null,
    ];

    const result = await db.query(query, values);
    const inserted = result.rows[0]?.inserted === true;

    return { ok: true, inserted };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}