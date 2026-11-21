/**
 * Критерии «чисто» (раздел 9 плана). Модуль НЕЗАВИСИМ от правил очистки:
 * детекция написана отдельно, импортируются только словари-конфиги.
 */
import { ALWAYS_FILLERS, DELIMITED_POSITIONAL, DELIMITED_MULTIWORD_ANYWHERE, REPEATED_WORD_EXCEPTIONS } from "@/core/cleanup/speech-fillers";
import type { Violation } from "@/shared/types";

export interface CriterionInput {
  text: string;
  /** Для V18: доля удалённого при очистке. */
  removedRatio?: number;
  maxRemovedRatio?: number;
}

export type Criterion = {
  id: string;
  severity: "error" | "warn";
  fixable: boolean;
  check(input: CriterionInput): { count: number; samples: string[] } | null;
};

const MAX_SAMPLE = 60;

function sample(m: string): string {
  const s = m.replace(/\s+/g, " ").trim();
  return s.length > MAX_SAMPLE ? s.slice(0, MAX_SAMPLE - 1) + "…" : s;
}

function firstMatches(text: string, re: RegExp, limit = 3): { count: number; samples: string[] } {
  const matches = [...text.matchAll(re)];
  return {
    count: matches.length,
    samples: matches.slice(0, limit).map((m) => sample(m[0])),
  };
}

/** Токен, который не считается смешанным словом: URL, e-mail, домен, файл. */
function isExemptToken(token: string): boolean {
  if (!token) return false;
  if (token.includes("://") || token.startsWith("www.")) return true;
  if (token.includes("@")) return true;
  if (/\.(?:ru|рф|com|org|net|io|ai|dev|app|info|biz|online|site|me|tv|co|us|uk|de|fr|edu|gov)$/i.test(token)) return true;
  if (/\.(?:pdf|docx?|txt|md|markdown|csv|xlsx?|pptx?|png|jpe?g|gif|zip|rar|7z|mp3|ogg|oga|wav|m4a|aac|flac)$/i.test(token)) return true;
  return false;
}

const HANGING_PREPS = new Set(["в", "на", "с", "и", "а", "но", "по", "к", "о", "у"]);

const PAGE_NUMBER_RE =
  /^[ \t]*(?:(?:[-–—[(]\s*)?\d{1,4}(?:\s*[-–—\])])?|(?:стр|page)\.?\s*\d+(?:\s*(?:из|of|\/)\s*\d+)?|\d{1,4}\s*\/\s*\d{1,4})[ \t]*$/gim;

const LEFT_BOUND = "(?<![\\p{L}\\p{N}_])";
const RIGHT_BOUND = "(?![\\p{L}\\p{N}_])";

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function alt(words: string[]): string {
  return words.slice().sort((a, b) => b.length - a.length).map(esc).join("|");
}

const ALWAYS_RE = new RegExp(`${LEFT_BOUND}(?:${alt(ALWAYS_FILLERS)})${RIGHT_BOUND}`, "giu");
const MULTIWORD_RE = new RegExp(`${LEFT_BOUND}(?:${alt(DELIMITED_MULTIWORD_ANYWHERE)})${RIGHT_BOUND}`, "giu");
const POSITIONAL = DELIMITED_POSITIONAL.filter((w) => w !== "ну");
const POSITIONAL_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])(?:${alt(POSITIONAL)})(?=[ \\t]*,)`,
  "gimu"
);
const NU_START_RE = new RegExp(
  `(?<=^|\\n|[.!?…]["»)]?[ \\t])ну(?!(?:[ \\t]*,)?[ \\t]*(?:и|а|но|же)(?![\\p{L}\\p{N}_]))(?=[ \\t]*,)`,
  "gimu"
);
const POSITIONAL_COMMA_RES = [
  new RegExp(`[,;][ \\t]*(?:${alt(POSITIONAL)})[ \\t]*[,;]`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${alt(POSITIONAL)})(?=$)`, "gim"),
  new RegExp(`[,;][ \\t]*(?:${alt(POSITIONAL)})(?=[ \\t]*—)`, "gim"),
];
const NU_COMMA_RES = [
  new RegExp(`[,;][ \\t]*ну(?!(?:[ \\t]*,)?[ \\t]*(?:и|а|но|же)(?![\\p{L}\\p{N}_]))[ \\t]*[,;]`, "gim"),
  new RegExp(`[,;][ \\t]*ну(?!(?:[ \\t]*,)?[ \\t]*(?:и|а|но|же)(?![\\p{L}\\p{N}_]))(?=$)`, "gim"),
  new RegExp(`[,;][ \\t]*ну(?!(?:[ \\t]*,)?[ \\t]*(?:и|а|но|же)(?![\\p{L}\\p{N}_]))(?=[ \\t]*—)`, "gim"),
];
const DASH_RE = new RegExp(
  `[ \\t]—[ \\t]*(?:${alt([...POSITIONAL, ...DELIMITED_MULTIWORD_ANYWHERE])})(?=[ \\t]*—)`,
  "gim"
);
const REPEATED_WORD_RE = new RegExp(
  `${LEFT_BOUND}([A-Za-zА-Яа-яЁё]+)((?:[ \\t]+\\1${RIGHT_BOUND})+)`,
  "giu"
);
const STUTTER_RE = new RegExp(
  `${LEFT_BOUND}([A-Za-zА-Яа-яЁё]{1,5})(?:-\\1)+-`,
  "giu"
);
const HANGING_FRAGMENT_RE = /(?<![\p{L}\p{N}_])[A-Za-zА-Яа-яЁё]{1,3}-[ \t]*$/gmu;

export const CRITERIA: Criterion[] = [
  {
    id: "V1",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const tags = firstMatches(text, /<[^>\n]{0,200}>/g);
      const entities = firstMatches(text, /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi);
      const count = tags.count + entities.count;
      if (count === 0) return null;
      return { count, samples: [...tags.samples, ...entities.samples].slice(0, 3) };
    },
  },
  {
    id: "V2",
    severity: "error",
    fixable: true,
    check: ({ text }) => firstMatches(text, /[ \t]+$/gm),
  },
  {
    id: "V3",
    severity: "error",
    fixable: true,
    check: ({ text }) => firstMatches(text, /^[ \t]+/gm),
  },
  {
    id: "V4",
    severity: "error",
    fixable: true,
    check: ({ text }) => firstMatches(text, /\n{3,}/g),
  },
  {
    id: "V5",
    severity: "error",
    fixable: true,
    check: ({ text }) => firstMatches(text, /[ \t]{2,}/g),
  },
  {
    id: "V6",
    severity: "error",
    fixable: true,
    check: ({ text }) => firstMatches(text, /\uFFFD/g),
  },
  {
    id: "V7",
    severity: "error",
    fixable: true,
    check: ({ text }) =>
      firstMatches(text, /[\u200B-\u200D\u2060\uFEFF\u00AD\u00A0\u202F\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g),
  },
  {
    id: "V8",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const tokens = text.split(/\s+/).filter(Boolean);
      const bad = tokens.filter((t) => {
        if (isExemptToken(t)) return false;
        const cyr = /[А-Яа-яЁё]/.test(t);
        const lat = /[A-Za-z]/.test(t);
        return cyr && lat;
      });
      if (bad.length === 0) return null;
      return { count: bad.length, samples: bad.slice(0, 3).map(sample) };
    },
  },
  {
    id: "V9",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const lines = text.split("\n");
      const found: string[] = [];
      for (let i = 0; i < lines.length - 1; i++) {
        const cur = lines[i].trimEnd();
        const next = lines[i + 1].trim();
        if (!cur || !next) continue;
        const last = cur.split(/\s+/).pop() ?? "";
        if (!HANGING_PREPS.has(last.toLowerCase()) || isExemptToken(last)) continue;
        const firstToken = next.split(/\s+/)[0];
        if (isExemptToken(firstToken) || /^\d/.test(firstToken)) continue;
        found.push(sample(cur));
        if (found.length >= 3) break;
      }
      if (found.length === 0) return null;
      return { count: found.length, samples: found };
    },
  },
  {
    id: "V10",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const beforePunct = firstMatches(text, /[ \t]+[.,;:!?]/g);
      const aroundSlash = firstMatches(
        text,
        /[\p{L}\p{N}][ \t]+\/[ \t]*[\p{L}\p{N}]|[\p{L}\p{N}][ \t]*\/[ \t]+[\p{L}\p{N}]/gu
      );
      const count = beforePunct.count + aroundSlash.count;
      if (count === 0) return null;
      return { count, samples: [...beforePunct.samples, ...aroundSlash.samples].slice(0, 3) };
    },
  },
  {
    id: "V11",
    severity: "error",
    fixable: true,
    check: ({ text }) => firstMatches(text, ALWAYS_RE),
  },
  {
    id: "V12",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const passes = [POSITIONAL_START_RE, NU_START_RE, ...POSITIONAL_COMMA_RES, ...NU_COMMA_RES, DASH_RE, MULTIWORD_RE];
      let count = 0;
      const samples: string[] = [];
      for (const re of passes) {
        for (const m of text.matchAll(re)) {
          count++;
          if (samples.length < 3) samples.push(sample(m[0]));
        }
      }
      if (count === 0) return null;
      return { count, samples };
    },
  },
  {
    id: "V13",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      let count = 0;
      const samples: string[] = [];
      for (const m of text.matchAll(REPEATED_WORD_RE)) {
        if (REPEATED_WORD_EXCEPTIONS.includes(m[1].toLowerCase())) continue;
        count += m[2].trim().split(/[ \t]+/).length;
        if (samples.length < 3) samples.push(sample(m[0]));
      }
      if (count === 0) return null;
      return { count, samples };
    },
  },
  {
    id: "V14",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const stutters = firstMatches(text, STUTTER_RE);
      const hanging = firstMatches(text, HANGING_FRAGMENT_RE);
      const count = stutters.count + hanging.count;
      if (count === 0) return null;
      return { count, samples: [...stutters.samples, ...hanging.samples].slice(0, 3) };
    },
  },
  {
    id: "V15",
    severity: "error",
    fixable: true,
    check: ({ text }) => {
      const pages = firstMatches(text, PAGE_NUMBER_RE);
      const separators = firstMatches(text, /^[ \t]*([-*•—_=])\1{2,}[ \t]*$/gm);
      const count = pages.count + separators.count;
      if (count === 0) return null;
      return { count, samples: [...pages.samples, ...separators.samples].slice(0, 3) };
    },
  },
  {
    id: "V16",
    severity: "error",
    fixable: false,
    check: ({ text }) => {
      if (/[\p{L}]/u.test(text)) return null;
      return { count: 1, samples: ["текст не содержит слов"] };
    },
  },
  {
    id: "V17",
    severity: "warn",
    fixable: false,
    check: ({ text }) => {
      const letters = text.match(/[\p{L}]/gu) ?? [];
      if (letters.length === 0) return null;
      const cyr = letters.filter((ch) => /[А-Яа-яЁё]/.test(ch)).length;
      const ratio = cyr / letters.length;
      if (ratio >= 0.5) return null;
      return {
        count: 1,
        samples: [`доля кириллицы ${Math.round(ratio * 100)}%`],
      };
    },
  },
  {
    id: "V18",
    severity: "warn",
    fixable: false,
    check: ({ removedRatio, maxRemovedRatio }) => {
      if (removedRatio === undefined || maxRemovedRatio === undefined) return null;
      if (removedRatio <= maxRemovedRatio) return null;
      return {
        count: 1,
        samples: [`удалено ${Math.round(removedRatio * 100)}% символов (лимит ${Math.round(maxRemovedRatio * 100)}%)`],
      };
    },
  },
];
