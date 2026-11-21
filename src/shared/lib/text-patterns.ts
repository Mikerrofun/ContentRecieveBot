/**
 * Общие текстовые константы и хелперы для очистки (core/cleanup) и
 * валидатора (core/validate). Критерии остаются независимыми от правил:
 * здесь только словари-конфиги и паттерны, никакой логики починки.
 *
 * Внимание: PAGE_NUMBER_RE глобальный (/g) — использовать только через
 .replace()/.matchAll(), не через .test() (lastIndex).
 */

/** Висячие предлоги/союзы (план 8.3-C). */
export const HANGING_PREPOSITIONS = ["в", "на", "с", "и", "а", "но", "по", "к", "о", "у"];

/** Строка-«номер страницы»: «12», «- 12 -», «Стр. 12», «12 / 40», «Page 3 of 10». */
export const PAGE_NUMBER_RE =
  /^[ \t]*(?:(?:[-–—[(]\s*)?\d{1,4}(?:\s*[-–—\])])?|(?:стр|page)\.?\s*\d+(?:\s*(?:из|of|\/)\s*\d+)?|\d{1,4}\s*\/\s*\d{1,4})[ \t]*$/gim;

/** Границы «слова» для регулярок: не буква, не цифра, не подчёркивание. */
export const WORD_LEFT_BOUND = "(?<![\\p{L}\\p{N}_])";
export const WORD_RIGHT_BOUND = "(?![\\p{L}\\p{N}_])";

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Альтернация слов, длинные варианты раньше коротких (иначе «ну-у» съест «ну»). */
export function buildAlternation(words: string[]): string {
  return words
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
}
