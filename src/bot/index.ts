import { Bot, GrammyError, HttpError } from "grammy";
import { registerCommands } from "./commands";
import { registerTextHandler } from "./handlers/text";
import { registerDocumentHandler } from "./handlers/document";
import { registerVoiceHandler, registerAudioHandler } from "./handlers/audio";
import { registerMediaUnsupportedHandler } from "./handlers/media-unsupported";
import { registerCallbacks } from "./callbacks";
import { getEnv } from "@/shared/config/env";
import { logger } from "@/shared/lib/logger";

export function createBot(token: string): Bot {
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

  return bot;
}

/** Синглтон на globalThis — переживает HMR в dev-режиме Next.js. */
const g = globalThis as unknown as { __botInstance?: Bot; __botInitPromise?: Promise<void> };

export function getBot(): Bot {
  if (!g.__botInstance) {
    g.__botInstance = createBot(getEnv().TELEGRAM_BOT_TOKEN);
  }
  return g.__botInstance;
}

/** 
 * Инициализация бота для webhook-режима.
 * Вызывается один раз при старте сервера из instrumentation.ts
 */
export async function initBot(): Promise<void> {
  if (g.__botInitPromise) return g.__botInitPromise;
  
  g.__botInitPromise = (async () => {
    const bot = getBot();
    await bot.init();
    logger.info("bot initialized", { username: bot.botInfo.username });
  })();
  
  await g.__botInitPromise;
}
