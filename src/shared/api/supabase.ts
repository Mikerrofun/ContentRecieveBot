import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/shared/config/env";

let client: SupabaseClient | null = null;

/**
 * Единственный клиент Supabase. Service key живёт только на сервере
 * (env), клиент создаётся лениво при первой записи.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = getEnv();
    client = createClient(env.DATABASE_URL, env.DATABASE_API_SUPABSE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
