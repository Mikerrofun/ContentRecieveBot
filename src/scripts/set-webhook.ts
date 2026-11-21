/**
 * Управление webhook для прод-деплоя (Railway).
 *   npm run set-webhook           — установить webhook
 *   npm run set-webhook -- --delete — удалить webhook (перед переходом на polling)
 */
import { loadEnvForScripts } from "@/config/loadEnv";

async function main(): Promise<void> {
  loadEnvForScripts();
  const { Bot } = await import("grammy");
  const { getEnv } = await import("@/config/env");
  const { logger } = await import("@/shared/logger");

  const env = getEnv();
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
  const isDelete = process.argv.includes("--delete");

  if (isDelete) {
    await bot.api.deleteWebhook({ drop_pending_updates: true });
    logger.info("webhook deleted");
    return;
  }

  if (!env.PUBLIC_BASE_URL || !env.TELEGRAM_WEBHOOK_SECRET) {
    logger.error("нужны PUBLIC_BASE_URL и TELEGRAM_WEBHOOK_SECRET");
    process.exit(1);
  }

  const url = `${env.PUBLIC_BASE_URL.replace(/\/+$/, "")}${env.WEBHOOK_PATH}`;
  await bot.api.setWebhook(url, {
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });

  const info = await bot.api.getWebhookInfo();
  logger.info("webhook set", {
    url: info.url,
    pendingUpdates: info.pending_update_count,
    lastError: info.last_error_message ?? null,
  });
}

void main();
