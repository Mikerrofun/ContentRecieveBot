import type { Rule } from "./rules";
import { bump, ok } from "./rules";

const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  laquo: "«",
  raquo: "»",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  middot: "·",
  bull: "•",
};

function decodeEntity(m: string): string {
  const body = m.slice(1, -1).toLowerCase();
  if (body.startsWith("#x")) {
    const code = parseInt(body.slice(2), 16);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  if (body.startsWith("#")) {
    const code = parseInt(body.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  }
  return HTML_ENTITIES[body] ?? m;
}

/** A. Механика — применяется ко всему входу. */
export const mechanicalRules: Rule[] = [
  {
    id: "m-eol-bom",
    category: "mechanical",
    run: (t) => {
      const out = t.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
      return { text: out, count: out === t ? 0 : 1 };
    },
  },
  {
    id: "m-html-tags",
    category: "mechanical",
    run: (t) => {
      let count = 0;
      let out = t.replace(/<br\s*\/?>/gi, () => {
        count++;
        return "\n";
      });
      out = out.replace(/<\/?[a-zA-Z][^>\n]*>/g, () => {
        count++;
        return "";
      });
      out = out.replace(/&(?:[a-z]+|#\d+|#x[0-9a-f]+);/gi, (m) => {
        count++;
        return decodeEntity(m);
      });
      return { text: out, count };
    },
  },
  {
    id: "m-invisible",
    category: "mechanical",
    run: (t) => {
      let count = 0;
      let out = t.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, () => {
        count++;
        return "";
      });
      out = out.replace(/[\u00A0\u202F\u2007]/g, () => {
        count++;
        return " ";
      });
      return { text: out, count };
    },
  },
  {
    id: "m-replacement-char",
    category: "mechanical",
    run: (t) => {
      const matches = t.match(/\uFFFD/g);
      const count = matches ? matches.length : 0;
      // Символ замены — сигнал битой кодировки; удаляем и считаем.
      return { text: t.replace(/\uFFFD/g, ""), count };
    },
  },
  {
    id: "m-whitespace",
    category: "mechanical",
    run: (t) => {
      let count = 0;
      const lines = t.split("\n").map((line) => {
        const collapsed = line.replace(/[ \t]+/g, " ").replace(/^ | $/g, "");
        if (collapsed !== line) count++;
        return collapsed;
      });
      return { text: lines.join("\n"), count };
    },
  },
  {
    id: "m-blank-lines",
    category: "mechanical",
    run: (t) => {
      let count = 0;
      let out = t.replace(/\n{3,}/g, () => {
        count++;
        return "\n\n";
      });
      const trimmed = out.replace(/^\n+/, "").replace(/\n+$/, "");
      if (trimmed !== out) {
        count++;
        out = trimmed;
      }
      return { text: out, count };
    },
  },
];

export const finalNormalizationRule: Rule = {
  id: "m-final-spaces",
  category: "mechanical",
  run: (t) => {
    let count = 0;
    let out = t.replace(/[ \t]+/g, " ");
    if (out !== t) count++;
    const lines = out.split("\n").map((l) => l.replace(/^ | $/g, ""));
    out = lines.join("\n");
    const collapsed = out.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "");
    if (collapsed !== out) count++;
    return { text: collapsed, count };
  },
};
