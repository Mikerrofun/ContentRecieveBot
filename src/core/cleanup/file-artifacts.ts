import type { CleanupContext, Rule } from "./rules";
import { bump, ok } from "./rules";
import { isProtectedToken } from "./protect";

const PAGE_NUMBER_RE =
  /^[ \t]*(?:(?:[-–—[(]\s*)?\d{1,4}(?:\s*[-–—\])])?|(?:стр|page)\.?\s*\d+(?:\s*(?:из|of|\/)\s*\d+)?|\d{1,4}\s*\/\s*\d{1,4})[ \t]*$/gim;

/** B. Артефакты файлов — в основном PDF, но безопасно для любых. */
export const fileArtifactRules: Rule[] = [
  {
    id: "f-page-numbers",
    category: "file-artifacts",
    run: (t) => {
      let count = 0;
      const out = t.replace(PAGE_NUMBER_RE, () => {
        count++;
        return "";
      });
      return { text: out, count };
    },
  },
  {
    id: "f-headers-footers",
    category: "file-artifacts",
    run: (t) => {
      const lines = t.split("\n");
      const counts = new Map<string, number>();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length > 80) continue;
        const norm = trimmed.replace(/\d+/g, "#");
        counts.set(norm, (counts.get(norm) ?? 0) + 1);
      }
      const repeated = new Set([...counts.entries()].filter(([, n]) => n >= 3).map(([k]) => k));
      if (repeated.size === 0) return ok(t);
      let count = 0;
      const out = lines
        .filter((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.length > 80) return true;
          if (repeated.has(trimmed.replace(/\d+/g, "#"))) {
            count++;
            return false;
          }
          return true;
        })
        .join("\n");
      return { text: out, count };
    },
  },
  {
    id: "f-dehyphenate",
    category: "file-artifacts",
    run: (t) => {
      let count = 0;
      // Перенос слова на конце строки: склеиваем, только если следующая
      // строка начинается со строчной буквы.
      const out = t.replace(/([A-Za-zА-Яа-яЁё])-\n([a-zа-яё])/g, (_m, a, b) => {
        count++;
        return a + b;
      });
      return { text: out, count };
    },
  },
  {
    id: "f-hard-wraps",
    category: "file-artifacts",
    run: (t, ctx: CleanupContext) => {
      if (!ctx.joinHardWraps) return ok(t);
      const lines = t.split("\n");
      const outLines: string[] = [];
      let count = 0;
      for (let i = 0; i < lines.length; i++) {
        const cur = lines[i];
        const next = lines[i + 1];
        if (next === undefined) {
          outLines.push(cur);
          continue;
        }
        const curTrim = cur.trimEnd();
        const nextTrim = next.trim();
        if (
          curTrim.length > 0 &&
          nextTrim.length > 0 &&
          // предыдущая строка не заканчивается концом предложения
          !/[.!?:;!?…]["»)]?$/.test(curTrim) &&
          // следующая строка начинается со строчной буквы
          /^[a-zа-яё]/.test(nextTrim) &&
          // и не начинается с домена/URL/e-mail/числа/маркера списка
          !isProtectedToken(nextTrim.split(/\s+/)[0]) &&
          !/^\d/.test(nextTrim) &&
          !/^[-*•]\s/.test(nextTrim) &&
          !/^\d+[.)]\s/.test(nextTrim)
        ) {
          outLines.push(curTrim + " " + nextTrim);
          count++;
          i++; // пропускаем склеенную строку
        } else {
          outLines.push(cur);
        }
      }
      return { text: outLines.join("\n"), count };
    },
  },
  {
    id: "f-toc-dots",
    category: "file-artifacts",
    run: (t) => {
      let count = 0;
      // Оглавления с точками-заполнителями: «Раздел ........ 12»
      const out = t.replace(/[ \t]*\.{2,}[ \t]*(?=\d{1,4}[ \t]*$)/gm, () => {
        count++;
        return " ";
      });
      return { text: out, count };
    },
  },
];

export function runFileArtifacts(text: string, ctx: CleanupContext): string {
  let out = text;
  for (const rule of fileArtifactRules) {
    const res = rule.run(out, ctx);
    bump(ctx, rule.category, rule.id, res.count);
    out = res.text;
  }
  return out;
}
