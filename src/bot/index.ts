import { Bot, GrammyError, HttpError } from "grammy";
import { registerCommands } from "./commands";
import { registerTextHandler } from "./handlers/text";
import { registerDocumentHandler } from "./handlers/document";
import { registerVoiceHandler, registerAudioHandler } from "./handlers/audio";
import { registerMediaUnsupportedHandler } from "./handlers/media-unsupported";
import { registerCallbacks } from "./callbacks";
import { getEnv } from "@/shared/config/env";
import { logger } from "@/shared/lib/logger";

export async function createBot(token: string): Promise<Bot> {
  const bot = new Bot(token);

  // Команды регистрируются раньше текстового обработчика
  registerCommands(bot);
  registerTextHandler(bot);
  registerDocumentHandler(bot);
  registerVoiceHandler(bot);
  registerAudioHandler(bot);
  registerMediaUnsupportedHandler(bot);
  registerCallbacks(bot);

  bot.catch((err) => {
    // В лог — только тип ошибки и id апдейта, без содержимого сообщений
    const ctx = err.ctx;
    logger.error("bot handler error", {
      updateId: ctx.update?.update_id,
      error:
        err.error instanceof GrammyError || err.error instanceof HttpError
          ? err.error.message
          : String(err.error),
    });
  });

  // Инициализируем бота для webhook-режима
  await bot.init();

  return bot;
}

/** Синглтон на globalThis — переживает HMR в dev-режиме Next.js. */
const g = globalThis as unknown as { __botInstance?: Bot; __botInitPromise?: Promise<Bot> };

export function getBot(): Bot {
  if (!g.__botInstance) {
    throw new Error("Bot not initialized! Call initBot() first.");
  }
  return g.__botInstance;
}

/** Инициализация бота (асинхронная, вызывается один раз при старте). */
export async function initBot(): Promise<Bot> {
  if (g.__botInstance) return g.__botInstance;
  if (g.__botInitPromise) return g.__botInitPromise;

  g.__botInitPromise = createBot(getEnv().TELEGRAM_BOT_TOKEN);
  g.__botInstance = await g.__botInitPromise;
  return g.__botInstance;
}
