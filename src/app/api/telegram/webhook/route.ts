import type { Update } from "@grammyjs/types";
import { getBot } from "@/bot";
import { getEnv } from "@/shared/config/env";
import { enqueueTask, isDuplicateUpdate } from "@/features/queue";

/**
 * Приём webhook от Telegram. Проверяем секретный заголовок, дедуплицируем
 * по update_id, ставим апдейт в очередь и сразу отвечаем 200 — долгая
 * обработка не держит соединение.
 */
export async function POST(req: Request): Promise<Response> {
  let env;
  try {
    env = getEnv();
  } catch {
    return new Response("config error", { status: 500 });
  }

  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("bad request", { status: 400 });
  }

  if (isDuplicateUpdate(update.update_id)) {
    return new Response("OK");
  }

  enqueueTask("handle-update", () => getBot().handleUpdate(update));
  return new Response("OK");
}
