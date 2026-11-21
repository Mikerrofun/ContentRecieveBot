/**
 * Dev-режим: long polling. Webhook удаляется, чтобы Telegram не слал
 * апдейты на прод-адрес, пока бот работает локально.
 */
import { loadEnvForScripts } from "@/config/loadEnv";

async function main(): Promise<void> {
  loadEnvForScripts();
  const { getEnv } = await import("@/config/env");
  const { createBot } = await import("@/bot");
  const { logger } = await import("@/shared/logger");

  const env = getEnv();
  if (env.BOT_MODE !== "polling") {
    logger.warn("BOT_MODE != polling — скрипт всё равно запускает long polling");
  }

  const bot = createBot(env.TELEGRAM_BOT_TOKEN);

  await bot.api.deleteWebhook({ drop_pending_updates: true });
  await bot.api.setMyCommands([
    { command: "StartProcess", description: "Открыть сессию приёма материала" },
    { command: "done", description: "Обработать всё и получить результат" },
    { command: "cancel", description: "Отменить сессию" },
    { command: "status", description: "Что уже в сессии" },
    { command: "help", description: "Как пользоваться ботом" },
  ]);

  bot.start();
  logger.info("long polling started", { provider: env.WHISPER_PROVIDER });

  const stop = () => {
    logger.info("stopping bot");
    void bot.stop().finally(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

void main();
