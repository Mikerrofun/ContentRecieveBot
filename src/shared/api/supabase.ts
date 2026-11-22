import { Pool, type PoolClient } from "pg";
import { getEnv } from "@/shared/config/env";

let pool: Pool | null = null;

/**
 * PostgreSQL connection pool для работы с Supabase.
 * Создаётся лениво при первом обращении.
 */
export function getDatabase(): Pool {
  if (!pool) {
    const env = getEnv();
    pool = new Pool({
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

/**
 * Получить клиент из пула для транзакций
 */
export async function getClient(): Promise<PoolClient> {
  return getDatabase().connect();
}
