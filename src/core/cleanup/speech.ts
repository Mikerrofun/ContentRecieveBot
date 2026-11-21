import type { CleanupContext, Rule } from "./rules";
import { bump, ok } from "./rules";
import {
  ALWAYS_FILLERS,
  DELIMITED_MULTIWORD_ANYWHERE,
  DELIMITED_POSITIONAL,
  NU_CONJUNCTION_GUARD,
} from "./speech-fillers";

const LEFT_BOUND = "(?<![\\p{L}\\p{N}_])";
const RIGHT_BOUND = "(?![\\p{L}\\p{N}_])";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function alternation(words: string[]): string {
  return words
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRe)
    .join("|");
}

const ALWAYS_RE = new RegExp(
  `${LEFT_BOUND}(?:${alternation(ALWAYS_FILLERS)})${RIGHT_BOUND}[ \\t]*`,
  "giu"
);

const MULTIWORD_ANYWHERE_RE = new RegExp(
  `${LEFT_BOUND}(?:${alternation(DELIMITED_MULTIWORD_ANYWHERE)})${RIGHT_BOUND}[ \\t]*`,
  "giu"
);

// «ну» — с защитой «ну и ладно»
const NU_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])ну${NU_CONJUNCTION_GUARD}(?=[ \\t]*,)`,
  "gimu"
);
const POSITIONAL_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])(?:${alternation(DELIMITED_POSITIONAL.filter((w) => w !== "ну"))})(?=[ \\t]*,)`,
  "gimu"
);
// «мы, типа, сделали» → «мы сделали»: паразит между запятыми — убираем
// его вместе с одной из запятых, чтобы не оставлять висячую запятую.
const POSITIONAL_WORDS = alternation(DELIMITED_POSITIONAL.filter((w) => w !== "ну"));
const NU_COMMA_RES = [
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}[ \\t]*[,;]`, "gim"),
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}(?=$)`, "gim"),
  new RegExp(`[,;][ \\t]*ну${NU_CONJUNCTION_GUARD}(?=[ \\t]*—)`, "gim"),
];
const POSITIONAL_COMMA_RES = [
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})[ \\t]*[,;]`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})(?=$)`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${POSITIONAL_WORDS})(?=[ \\t]*—)`, "gim"),
];
const DASH_RE = new RegExp(
  `[ \\t]—[ \\t]*(?:${alternation([...DELIMITED_POSITIONAL, ...DELIMITED_MULTIWORD_ANYWHERE])})(?=[ \\t]*—)`,
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

export function runSpeech(text: string, ctx: CleanupContext): string {
  let out = text;
  for (const rule of speechRules) {
    const res = rule.run(out, ctx);
    bump(ctx, rule.category, rule.id, res.count);
    out = res.text;
  }
  return out;
}

export { ok };
