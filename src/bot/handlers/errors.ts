import { isAppError } from "@/shared/errors";
import { messages } from "@/bot/messages";

/** Сообщение пользователю для любой ошибки: понятный текст, без деталей. */
export function userMessageFor(e: unknown): string {
  if (isAppError(e)) return e.userMessage;
  return messages.genericError();
}
