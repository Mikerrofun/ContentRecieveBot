import type { MiddlewareFn } from "grammy";
import type { Context } from "grammy";
import { getAllowedTelegramIds, getEnv } from "@/config/env";

/**
 * Whitelist по Telegram ID. Посторонний, который найдёт бота, получает
 * молчание (без ответа).
 */
export const whitelistMiddleware: MiddlewareFn<Context> = (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return; // апдейты без отправителя молча игнорируем
  const allowed = getAllowedTelegramIds(getEnv());
  if (!allowed.has(userId)) return; // молчание, без ответа
  return next();
};
