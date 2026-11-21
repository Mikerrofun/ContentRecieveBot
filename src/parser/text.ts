import { EmptyContentError } from "@/shared/errors";

/**
 * md/txt читаются как UTF-8; при невалидной кодировке (символы замены
 * U+FFFD) пробуется windows-1251, иначе ошибка.
 */
export function extractPlainText(buffer: Buffer): string {
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("\uFFFD")) {
    if (utf8.replace(/\s/g, "").length === 0) throw new EmptyContentError();
    return utf8;
  }

  const cp1251 = new TextDecoder("windows-1251").decode(buffer);
  if (cp1251.includes("\uFFFD")) {
    throw new EmptyContentError("Не удалось определить кодировку файла");
  }
  if (cp1251.replace(/\s/g, "").length === 0) throw new EmptyContentError();
  return cp1251;
}
