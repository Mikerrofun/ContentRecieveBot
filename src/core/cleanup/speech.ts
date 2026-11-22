import type { Rule } from "./rules";
import {
  ALWAYS_FILLERS,
  DELIMITED_MULTIWORD_ANYWHERE,
  DELIMITED_POSITIONAL,
  NU_CONJUNCTION_GUARD,
} from "@/shared/config/speech-fillers";
import {
  WORD_LEFT_BOUND,
  WORD_RIGHT_BOUND,
  buildAlternation,
} from "@/shared/lib/text-patterns";

const ALWAYS_RE = new RegExp(
  `${WORD_LEFT_BOUND}(?:${buildAlternation(ALWAYS_FILLERS)})${WORD_RIGHT_BOUND}[ \\t]*,?`,
  "giu"
);

const MULTIWORD_ANYWHERE_RE = new RegExp(
  `${WORD_LEFT_BOUND}(?:${buildAlternation(DELIMITED_MULTIWORD_ANYWHERE)})${WORD_RIGHT_BOUND}[ \\t]*,?`,
  "giu"
);

// «ну» — с защитой «ну и ладно»; удаляется в начале предложения и с запятой
const NU_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])ну${NU_CONJUNCTION_GUARD}[ \\t]*,?[ \\t]*(?=[A-Za-zА-Яа-яЁё]|$)`,
  "gimu"
);
const POSITIONAL_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])(?:${buildAlternation(DELIMITED_POSITIONAL.filter((w) => w !== "ну"))})(?=[ \\t]*,)`,
  "gimu"
);
// «мы, типа, сделали» → «мы сделали»: паразит между запятыми — убираем
// его вместе с одной из запятых, чтобы не оставлять висячую запятую.
const POSITIONAL_WORDS = buildAlternation(DELIMITED_POSITIONAL.filter((w) => w !== "ну"));
const NU_COMMA_RES = [
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}[ \\t]*[,;]`, "gim"),
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}(?=$)`, "gim"),
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}(?=[ \\t]*—)`, "gim"),
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}(?=[ \\t]*[.!?…])`, "gim"),
];
const POSITIONAL_COMMA_RES = [
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})[ \\t]*[,;]`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})(?=$)`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})(?=[ \\t]*—)`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})(?=[ \\t]*[.!?…])`, "gim"),
];
const DASH_RE = new RegExp(
  `[ \\t]—[ \\t]*(?:${buildAlternation([...DELIMITED_POSITIONAL, ...DELIMITED_MULTIWORD_ANYWHERE])})(?=[ \\t]*—)`,
  "gim"
);
// «...1000 знаков, да» → «...1000 знаков»: «да»-тег в конце фразы
const TRAILING_DA_RE = /,[ \t]*да(?=[ \t]*(?:$|[.!?…]))/gim;
// «символов, да, именно» → «символов, именно»: «да» между запятыми
const PAREN_DA_RE = /,[ \t]*да(?=[ \t]*,)/g;

// Союзы, после которых вырезанный филлер «забирает» свою запятую с собой
// («И вот, иду я» → «И иду я»), а не оставляет её предыдущему слову.
const CONJUNCTIONS_BEFORE = new Set([
  "и", "а", "но", "или", "либо", "что", "как", "когда",
  "чтобы", "если", "хотя", "ведь", "будто", "пока",
]);

/**
 * Чем заменить вырезанный филлер. Если филлер потребил запятую после себя,
 * она возвращается предыдущему слову («забыл ну просто, наверное» →
 * «забыл, наверное»), кроме случая, когда перед филлером стоит союз.
 */
function fillerReplacement(m: string, offset: number, s: string): string {
  if (!m.trimEnd().endsWith(",")) return "";
  const before = s.slice(0, offset).trimEnd();
  if (!/[A-Za-zА-Яа-яЁё]$/.test(before)) return "";
  const lastWord = (before.match(/[A-Za-zА-Яа-яЁё]+$/) ?? [""])[0].toLowerCase();
  if (CONJUNCTIONS_BEFORE.has(lastWord)) return "";
  return ", ";
}

/** D. Речь — паразиты, заикания, повторы. Применяется ко всему тексту. */
export const speechRules: Rule[] = [
  {
    id: "s-fillers-always",
    category: "speech",
    run: (t) => {
      let count = 0;
      const out = t.replace(ALWAYS_RE, (m, offset: number, s: string) => {
        count++;
        return fillerReplacement(m, offset, s);
      });
      return { text: out, count };
    },
  },
  {
    id: "s-fillers-delimited",
    category: "speech",
    run: (t) => {
      let count = 0;
      let out = t;
      const passes = [MULTIWORD_ANYWHERE_RE, NU_START_RE, POSITIONAL_START_RE, ...NU_COMMA_RES, ...POSITIONAL_COMMA_RES, DASH_RE, TRAILING_DA_RE, PAREN_DA_RE];
      for (const re of passes) {
        const smart = re === MULTIWORD_ANYWHERE_RE;
        out = out.replace(re, (m: string, offset: number, s: string) => {
          count++;
          return smart ? fillerReplacement(m, offset, s) : "";
        });
      }
      return { text: out, count };
    },
  },
  {
    id: "s-elongated",
    category: "speech",
    run: (t) => {
      let count = 0;
      // Дефисные растяжки: «да-а-а» → «да» (ну-у-у и э-э-э уже в ALWAYS_FILLERS)
      let out = t.replace(
        /(?<![\p{L}\p{N}_])([A-Za-zА-Яа-яЁё]+)(?:-([A-Za-zА-Яа-яЁё]))(?:-\2)+(?![\p{L}\p{N}_])/giu,
        (m, word: string, letter: string) => {
          if (word.slice(-1).toLowerCase() !== letter.toLowerCase()) return m;
          count++;
          return word;
        }
      );
      // Повторяющиеся буквы: «нууу» → «ну»; аббревиатуры вида СССР не трогаем
      out = out.replace(/(?<![\p{L}\p{N}_])[A-Za-zА-Яа-яЁё]+(?![\p{L}\p{N}_])/giu, (word) => {
        if (word === word.toUpperCase() && word.length > 1) return word;
        return word.replace(/([A-Za-zА-Яа-яЁё])\1{2,}/gu, (_run, ch: string) => {
          count++;
          return ch;
        });
      });
      return { text: out, count };
    },
  },
  {
    id: "s-punct-fix",
    category: "speech",
    run: (t) => {
      let count = 0;
      let out = t;
      // Хвосты после удаления паразитов: «, ,», запятая в начале строки/предложения
      const doubled = out.replace(/[,;][ \t]*[,;]/g, () => {
        count++;
        return ",";
      });
      out = doubled;
      out = out.replace(/(^|\n)[ \t]*[,;][ \t]*/gm, (_m, p) => {
        count++;
        return p;
      });
      // Регистр первой буквы предложения (только слова от 2 букв, чтобы не
      // задевать сокращения вида «т. е.», «и т. д.»)
      out = out.replace(/(^|\n|[.!?…][ \t]+)([а-яё])(?=[а-яё])/gm, (_m, pre, ch) => {
        count++;
        return pre + ch.toUpperCase();
      });
      // «И, ...» → «И ...»: запятая после одиночного союза — артефакт вырезания филлера
      out = out.replace(/(^|\n|[.!?…][ \t]+)([ИиАа]),[ \t]+(?=[а-яёa-z])/g, (_m, pre: string, conj: string) => {
        count++;
        return pre + conj + " ";
      });
      return { text: out, count };
    },
  },
];
