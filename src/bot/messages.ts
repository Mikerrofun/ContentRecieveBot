/**
 * Все НЕошибочные тексты бота (русский) — в одном месте.
 * Тексты ошибок живут в shared/lib/errors (userMessage) и дублируются
 * обработчиками через userMessageFor.
 */
import type { Session } from "@/entities/session";

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m} мин ${s} с` : `${s} с`;
}

export const messages = {
  help: () =>
    [
      "Я принимаю сырой материал и возвращаю чистый текст.",
      "",
      "Что принимаю:",
      "• голосовые и аудиофайлы (mp3, m4a, ogg, wav) — расшифровываю в текст",
      "• текст сообщениями",
      "• файлы: pdf, md, txt, docx",
      "",
      "Как пользоваться:",
      "1. /StartProcess — открыть сессию",
      "2. Присылай материалы подряд",
      "3. «Загрузить в систему» — обработать всё и получить файл + отчёт",
      "",
      "Лимиты: файлы до 20 МБ, аудио до 50 минут. Кружки и видео не обрабатываю.",
    ].join("\n"),

  sessionStarted: () =>
    "Сессия открыта. Присылай материал: голос, аудио, текст или файлы (pdf, md, txt, docx).",

  sessionAlreadyActive: () =>
    "Сессия уже открыта. Продолжай присылать материал или заверши её командой /cancel.",

  noSession: () => "Сначала вызови /StartProcess",

  processing: () => "Идёт обработка, подожди.",

  accepted: (label: string) => `Принято: ${label}. Ещё будут материалы?`,

  waitingMore: () => "Жду следующий материал",

  finalizing: () => "Обрабатываю…",

  nothingToLoad: () => "Нечего загружать — сессия пустая.",

  cancelConfirm: (items: number) =>
    `В сессии уже ${items} элемент(ов). Точно отменить? Материал будет потерян.`,

  cancelled: () => "Сессия отменена.",

  cancelKept: () => "Продолжаем. Жду следующий материал.",

  staleSession: () => "Сессия устарела, начни заново /StartProcess",

  status: (session: Session) => {
    const chars = session.items.reduce((n, i) => n + i.rawText.length, 0);
    const audioSec = session.items.reduce((n, i) => n + (i.meta.durationSec ?? 0), 0);
    const kindLabel: Record<Session["items"][number]["kind"], string> = {
      file: "файл",
      text: "текст",
      voice: "голос",
      audio: "аудио",
    };
    const parts = session.items.map(
      (i) => `• ${kindLabel[i.kind]}: ${i.label} (${i.rawText.length} симв.)`
    );
    return [
      `Сессия открыта, элементов: ${session.items.length}`,
      `Символов: ${chars}`,
      audioSec > 0 ? `Аудио: ${formatDuration(audioSec)}` : null,
      "",
      ...parts,
    ]
      .filter(Boolean)
      .join("\n");
  },

  circleUnsupported: () => "Кружки не обрабатываю, пришли голосовое или аудиофайл",

  videoUnsupported: () => "Видео не обрабатываю, пришли текст, аудио или файл",

  transcriptionRetry: () => "Не удалось расшифровать. Повторяю…",

  transcriptionFailed: () => "Не получилось, отправь запись ещё раз",

  genericError: () => "Что-то пошло не так, сессия сохранена, попробуй ещё раз",

  dbFailed: () =>
    "Запись в БД не удалась — материал остался в сессии, попробуй ещё раз /done",

  downloadFailed: () => "Не удалось скачать файл из Telegram, попробуй ещё раз",
};
