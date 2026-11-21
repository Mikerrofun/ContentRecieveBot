import type { FileSource } from "@/shared/lib/types";

export type ItemKind = "text" | "file" | "voice" | "audio";

export interface SessionItemMeta {
  fileName?: string;
  durationSec?: number;
  /** Источник текста — влияет на флаг JOIN_HARD_WRAPS при очистке. */
  source?: FileSource | "voice" | "audio" | "text";
  provider?: string;
  model?: string;
}

export interface SessionItem {
  id: string;
  kind: ItemKind;
  label: string;
  rawText: string;
  meta: SessionItemMeta;
}

export type SessionStatus = "collecting" | "processing";

export interface Session {
  chatId: number;
  status: SessionStatus;
  items: SessionItem[];
  createdAt: number;
  lastActivityAt: number;
  /** Текст принят, но окно склейки ещё не закрылось — промпт не отправлен. */
  pendingTextPrompt?: boolean;
}
