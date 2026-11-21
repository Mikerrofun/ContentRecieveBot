/**
 * Логгер БЕЗ содержимого текстов: сюда передаются только типы, id, счётчики.
 * Никогда не передавать сюда rawText, расшифровки и имена файлов с данными.
 */
function line(level: string, msg: string, meta?: Record<string, unknown>): void {
  const metaStr = meta ? " " + JSON.stringify(meta) : "";
  // eslint-disable-next-line no-console
  console.log(`[${level}] ${new Date().toISOString()} ${msg}${metaStr}`);
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => line("info", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => line("warn", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => line("error", msg, meta),
};
