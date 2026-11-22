/**
 * Next.js instrumentation hook — вызывается один раз при старте сервера.
 * Инициализируем бота для webhook-режима.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/shared/config/env");
    const { initBot } = await import("@/bot");
    const { logger } = await import("@/shared/lib/logger");

    const env = getEnv();
    
    if (env.BOT_MODE === "webhook") {
      await initBot();
      logger.info("bot initialized", { mode: "webhook" });
    }
  }
}
