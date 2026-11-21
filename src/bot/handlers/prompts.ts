import type { Bot } from "grammy";
import type { Session } from "@/entities/session";
import { messages } from "@/bot/messages";
import { acceptKeyboard } from "@/bot/keyboards";

/**
 * Окно склейки текста: подряд идущие текстовые сообщения собираются в один
 * элемент, промпт «Принято…» отправляется через 1.5 с после последнего.
 */
const TEXT_DEBOUNCE_MS = 1500;

const g = globalThis as unknown as { __textTimers?: Map<number, ReturnType<typeof setTimeout>> };
const timers: Map<number, ReturnType<typeof setTimeout>> = (g.__textTimers ??= new Map());

export function scheduleAcceptPrompt(bot: Bot, session: Session): void {
  const existing = timers.get(session.chatId);
  if (existing) clearTimeout(existing);
  session.pendingTextPrompt = true;
  timers.set(
    session.chatId,
    setTimeout(() => {
      timers.delete(session.chatId);
      void sendAcceptPrompt(bot, session);
    }, TEXT_DEBOUNCE_MS)
  );
}

/** Отменить отложенный промпт (например, перед обработкой файла). */
export function cancelPendingPrompt(session: Session): void {
  const timer = timers.get(session.chatId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(session.chatId);
  }
  session.pendingTextPrompt = false;
}

export async function sendAcceptPrompt(bot: Bot, session: Session): Promise<void> {
  session.pendingTextPrompt = false;
  const last = session.items[session.items.length - 1];
  if (!last) return;
  await bot.api.sendMessage(session.chatId, messages.accepted(last.label), {
    reply_markup: acceptKeyboard(),
  });
}

/**
 * Если текст ждёт промпта, а пришёл файл/аудио — сначала закрываем окно
 * склейки и отправляем промпт по тексту, потом обрабатываем новый материал.
 */
export async function flushPendingTextPrompt(bot: Bot, session: Session): Promise<void> {
  if (session.pendingTextPrompt) {
    cancelPendingPrompt(session);
    await sendAcceptPrompt(bot, session);
  }
}
