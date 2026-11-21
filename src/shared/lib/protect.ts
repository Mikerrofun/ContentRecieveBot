/**
 * Защита токенов, которые нельзя искажать правилами очистки:
 * код в бэктиках, URL, e-mail, домены, имена файлов.
 * Используется правилами очистки и критериями валидатора (один источник,
 * чтобы список исключений не разъезжался).
 */

const PROTECTED_PATTERNS: RegExp[] = [
  /`[^`\n]+`/g, // код в бэктиках
  /https?:\/\/\S+/g, // URL
  /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, // e-mail
  /\b(?:[\w-]+\.)+(?:ru|рф|com|org|net|io|ai|dev|app|info|biz|online|site|me|tv|co|us|uk|de|fr|edu|gov)\b/gi, // домены
  /\b[\w.-]+\.(?:pdf|docx?|txt|md|markdown|csv|xlsx?|pptx?|png|jpe?g|gif|zip|rar|7z|mp3|ogg|oga|wav|m4a|aac|flac)\b/gi, // имена файлов
];

const START = "\uE000";
const END = "\uE001";

export interface ProtectedText {
  text: string;
  restore: (t: string) => string;
}

export function protectSpans(text: string): ProtectedText {
  const saved: string[] = [];
  let out = text;

  for (const re of PROTECTED_PATTERNS) {
    out = out.replace(re, (m) => {
      saved.push(m);
      return `${START}${saved.length - 1}${END}`;
    });
  }

  return {
    text: out,
    restore: (t) => t.replace(new RegExp(`${START}(\\d+)${END}`, "g"), (_, i) => saved[Number(i)] ?? ""),
  };
}

/** Токен (слово без пробелов), который нельзя трогать: URL, e-mail, домен, файл, путь. */
export function isProtectedToken(token: string): boolean {
  if (!token) return false;
  if (token.includes("://") || token.startsWith("www.")) return true;
  if (token.includes("@")) return true;
  if (/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(token)) return true;
  if (/\.(?:ru|рф|com|org|net|io|ai|dev|app|info|biz|online|site|me|tv|co|us|uk|de|fr|edu|gov)$/i.test(token)) return true;
  if (/\.(?:pdf|docx?|txt|md|markdown|csv|xlsx?|pptx?|png|jpe?g|gif|zip|rar|7z|mp3|ogg|oga|wav|m4a|aac|flac)$/i.test(token)) return true;
  return false;
}
