import { getEnv } from "@/shared/config/env";
import type { Session, SessionItem } from "./model";

/**
 * Сессии живут в памяти процесса (план: бот ничего не хранит).
 * Перезапуск процесса теряет сессии — персистентности нет.
 */
const g = globalThis as unknown as { __botSessions?: Map<number, Session> };
const sessions: Map<number, Session> = (g.__botSessions ??= new Map());

function sweepExpired(): void {
  const ttlMs = getEnv().SESSION_TTL_MINUTES * 60 * 1000;
  const now = Date.now();
  for (const [chatId, session] of sessions) {
    if (now - session.lastActivityAt > ttlMs) {
      // TTL неактивной сессии — молча сбрасываем
      sessions.delete(chatId);
    }
  }
}

export function findActiveSession(chatId: number): Session | undefined {
  sweepExpired();
  const session = sessions.get(chatId);
  if (!session) return undefined;
  session.lastActivityAt = Date.now();
  return session;
}

export function createSession(chatId: number): Session {
  sweepExpired();
  const session: Session = {
    chatId,
    status: "collecting",
    items: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };
  sessions.set(chatId, session);
  return session;
}

export function clearSession(chatId: number): void {
  sessions.delete(chatId);
}

export function addItem(session: Session, item: SessionItem): void {
  session.items.push(item);
  session.lastActivityAt = Date.now();
}

/** Склейка подряд идущих текстовых сообщений в один элемент. */
export function appendTextToLast(session: Session, text: string): boolean {
  const last = session.items[session.items.length - 1];
  if (last && last.kind === "text") {
    last.rawText = `${last.rawText}\n${text}`;
    last.label = `текст (${last.rawText.length} симв.)`;
    session.lastActivityAt = Date.now();
    return true;
  }
  return false;
}
