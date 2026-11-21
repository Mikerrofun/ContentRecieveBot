import { addItem, appendTextToLast, type Session, type SessionItem } from "@/entities/session";
import { extractText } from "@/features/parse";
import { transcribeAudio } from "@/features/transcribe";

/**
 * Приём материала в сессию (план 6.3): каждый материал сразу превращается
 * в сырой текст и кладётся в сессию — ошибки видны сразу, ничего не теряется.
 */

/** Текст сообщением: склеивается с предыдущим текстовым элементом или новый. */
export function acceptText(session: Session, text: string): void {
  if (appendTextToLast(session, text)) return;
  addItem(session, {
    id: crypto.randomUUID(),
    kind: "text",
    label: `текст (${text.length} симв.)`,
    rawText: text,
    meta: { source: "text" },
  });
}

export interface FileInput {
  buffer: Buffer;
  fileName?: string;
  mime?: string;
}

/**
 * Файл → текстовый слой → элемент сессии. Подпись (caption) идёт отдельным
 * текстовым элементом перед файлом и добавляется только если файл разобрался.
 */
export async function acceptFile(
  session: Session,
  input: FileInput,
  opts: { caption?: string } = {}
): Promise<SessionItem> {
  const { text, source } = await extractText({
    buffer: input.buffer,
    fileName: input.fileName,
    mime: input.mime,
  });

  if (opts.caption) {
    addItem(session, {
      id: crypto.randomUUID(),
      kind: "text",
      label: `подпись (${opts.caption.length} симв.)`,
      rawText: opts.caption,
      meta: { source: "text" },
    });
  }

  const item: SessionItem = {
    id: crypto.randomUUID(),
    kind: "file",
    label: input.fileName ?? "файл",
    rawText: text,
    meta: { fileName: input.fileName, source },
  };
  addItem(session, item);
  return item;
}

export interface AudioInput {
  buffer: Buffer;
  fileName: string;
  mime: string;
  kind: "voice" | "audio";
  durationSec?: number;
  label: string;
}

/** Голос/аудио → Whisper → элемент сессии. */
export async function acceptAudio(session: Session, input: AudioInput): Promise<SessionItem> {
  const { text, provider, model } = await transcribeAudio({
    buffer: input.buffer,
    filename: input.fileName,
    mime: input.mime,
  });

  const item: SessionItem = {
    id: crypto.randomUUID(),
    kind: input.kind,
    label: input.label,
    rawText: text,
    meta: { durationSec: input.durationSec, source: input.kind, provider, model },
  };
  addItem(session, item);
  return item;
}
