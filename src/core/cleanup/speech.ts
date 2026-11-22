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
  `${WORD_LEFT_BOUND}(?:${buildAlternation(ALWAYS_FILLERS)})${WORD_RIGHT_BOUND}[ \\t]*`,
  "giu"
);

const MULTIWORD_ANYWHERE_RE = new RegExp(
  `${WORD_LEFT_BOUND}(?:${buildAlternation(DELIMITED_MULTIWORD_ANYWHERE)})${WORD_RIGHT_BOUND}[ \\t]*`,
  "giu"
);

// «ну» — с защитой «ну и ладно»
const NU_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])ну${NU_CONJUNCTION_GUARD}(?=[ \\t]*,)`,
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

/** D. Речь — паразиты, заикания, повторы. Применяется ко всему тексту. */
export const speechRules: Rule[] = [
  {
    id: "s-fillers-always",
    category: "speech",
    run: (t) => {
      let count = 0;
      const out = t.replace(ALWAYS_RE, () => {
        count++;
        return "";
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
      const passes = [MULTIWORD_ANYWHERE_RE, NU_START_RE, POSITIONAL_START_RE, ...NU_COMMA_RES, ...POSITIONAL_COMMA_RES, DASH_RE];
      for (const re of passes) {
        out = out.replace(re, () => {
          count++;
          return "";
        });
      }
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
      return { text: out, count };
    },
  },
];
