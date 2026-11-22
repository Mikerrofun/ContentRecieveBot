import type { CleanupContext, Rule } from "./rules";
import { isProtectedToken, protectSpans } from "@/shared/lib/protect";
import { HANGING_PREPOSITIONS } from "@/shared/lib/text-patterns";
import { REPEATED_WORD_EXCEPTIONS } from "@/shared/config/speech-fillers";

const CYR = "[А-Яа-яЁё]";
const LAT = "[A-Za-z]";

// Слова отмены для ложных стартов; без флага i, чтобы строчные классы
// [а-яёa-z] не матчили заглавные (защита терминов и имён собственных).
const CANCEL_WORDS = "(?:[нН]ет|[нН]е|[тТ]очнее|[вВ]ернее|[тТ]о[ \\t][еЕ]сть)";
const SENT_START = "(?<=^|\\n|[.!?…][\"»)]?[ \\t])";

const LAT_TO_CYR: Record<string, string> = {
  a: "а", e: "е", o: "о", p: "р", c: "с", x: "х", y: "у",
  A: "А", E: "Е", O: "О", P: "Р", C: "С", X: "Х", Y: "У", T: "Т",
};
const CYR_TO_LAT: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
  "А": "A", "Е": "E", "О": "O", "Р": "P", "С": "C", "Х": "X", "У": "Y", "Т": "T",
};

interface Tokenized {
  parts: string[];
  isWord: (p: string) => boolean;
}

function tokenize(text: string): Tokenized {
  const parts = text.split(/([ \t\n]+)/);
  return { parts, isWord: (p) => p.length > 0 && !/^[ \t\n]+$/.test(p) };
}

/** C. Точечные дефекты — склейки, обрезки слов, пунктуация/пробелы. */
export const defectRules: Rule[] = [
  {
    // Гомоглифы чинятся ДО склеек: слово с латинской буквой-двойником — это
    // одно кириллическое слово, а не место для вставки пробела.
    id: "d-homoglyphs",
    category: "defects",
    run: (t) => {
      const { parts, isWord } = tokenize(t);
      let count = 0;
      const out = parts
        .map((p) => {
          if (!isWord(p) || isProtectedToken(p) || /[\uE000-\uE001]/.test(p)) return p;
          const cyr = p.match(/[А-Яа-яЁё]/g) ?? [];
          const lat = p.match(/[A-Za-z]/g) ?? [];
          if (cyr.length === 0 || lat.length === 0) return p;
          if (cyr.length >= lat.length && lat.every((ch) => ch in LAT_TO_CYR)) {
            count += lat.length;
            return p.replace(/[A-Za-z]/g, (ch) => LAT_TO_CYR[ch] ?? ch);
          }
          if (lat.length > cyr.length && cyr.every((ch) => ch in CYR_TO_LAT)) {
            count += cyr.length;
            return p.replace(/[А-Яа-яЁё]/g, (ch) => CYR_TO_LAT[ch] ?? ch);
          }
          return p;
        })
        .join("");
      return { text: out, count };
    },
  },
  {
    id: "d-glue",
    category: "defects",
    run: (t) => {
      const { parts, isWord } = tokenize(t);
      let count = 0;
      const glueRe = new RegExp(`(${CYR})(${LAT})|(${LAT})(${CYR})`, "g");
      const out = parts
        .map((p) => {
          if (!isWord(p) || isProtectedToken(p) || /[\uE000-\uE001]/.test(p)) return p;
          return p.replace(glueRe, (m, c1, l1, l2, c2) => {
            count++;
            if (c1) return `${c1} ${l1}`;
            return `${l2} ${c2}`;
          });
        })
        .join("");
      return { text: out, count };
    },
  },
  {
    id: "d-truncated",
    category: "defects",
    run: (t) => {
      let count = 0;
      let out = t;
      // «пробле- проблема» → «проблема»: обрывок-префикс перед полным словом
      out = out.replace(
        /(?<![\p{L}\p{N}_])([A-Za-zА-Яа-яЁё]{2,})-[ \t]+(?=[A-Za-zА-Яа-яЁё])/gu,
        (m, frag: string, offset: number, s: string) => {
          const rest = s.slice(offset + m.length);
          const next = rest.match(/^[A-Za-zА-Яа-яЁё]+/);
          if (!next) return m;
          const f = frag.toLowerCase();
          const w = next[0].toLowerCase();
          if (w.startsWith(f) && f !== w) {
            count++;
            return "";
          }
          return m;
        }
      );
      // «какой- то» → «какой-то»: висящий пробел после дефиса
      out = out.replace(/([A-Za-zА-Яа-яЁё])[ \t]*-[ \t]+(?=[A-Za-zА-Яа-яЁё])/g, (_m, ch: string) => {
        count++;
        return ch + "-";
      });
      // «сл-» в конце строки без продолжения (короткий обрывок) → удалить
      out = out.replace(/(?<![\p{L}\p{N}_])[A-Za-zА-Яа-яЁё]{1,3}-[ \t]*$/gmu, () => {
        count++;
        return "";
      });
      return { text: out, count };
    },
  },
  {
    id: "d-false-start-dash",
    category: "defects",
    run: (t) => {
      let count = 0;
      // «я хотел — нет, я думаю» → «я думаю»; обрывок только со строчной
      const out = t.replace(
        new RegExp(
          `${SENT_START}([а-яёa-z]+(?:[ \\t]+[а-яёa-z]+){0,2})[ \\t]*[—–][ \\t]*${CANCEL_WORDS}[ \\t]*,[ \\t]*`,
          "gm"
        ),
        () => {
          count++;
          return "";
        }
      );
      return { text: out, count };
    },
  },
  {
    id: "d-false-start-comma",
    category: "defects",
    run: (t) => {
      let count = 0;
      // «в среду, нет, в четверг» → «в четверг»; обрывок только со строчной
      const out = t.replace(
        new RegExp(
          `${SENT_START}([а-яёa-z]+(?:[ \\t]+[а-яёa-z]+){0,2})[ \\t]*,[ \\t]*${CANCEL_WORDS}[ \\t]*,[ \\t]*`,
          "gm"
        ),
        () => {
          count++;
          return "";
        }
      );
      return { text: out, count };
    },
  },
  {
    id: "d-false-start-fragment",
    category: "defects",
    run: (t) => {
      let count = 0;
      // «он был в чёр— в синей» → «он был в синей»; только строчные обрывки
      // (термины вида «JavaScript— TypeScript» защищены регистром)
      const out = t.replace(/(?<![\p{L}\p{N}_])[а-яёa-z]{2,}[—–][ \t]+/gu, () => {
        count++;
        return "";
      });
      return { text: out, count };
    },
  },
  {
    id: "d-stutter",
    category: "defects",
    run: (t) => {
      let count = 0;
      // «по-по-посмотрим» → «посмотрим»; от 2 букв, чтобы не съедать
      // дефисные филлеры вида «э-э-э» (их убирает s-fillers-always)
      const out = t.replace(
        /(?<![\p{L}\p{N}_])([A-Za-zА-Яа-яЁё]{2,5})(?:-\1)+-(?=[A-Za-zА-Яа-яЁё])/giu,
        () => {
          count++;
          return "";
        }
      );
      return { text: out, count };
    },
  },
  {
    id: "d-repeated-words",
    category: "defects",
    run: (t) => {
      let count = 0;
      // «да-да», «вкусного-вкусного» → одно слово; чуть-чуть, еле-еле не трогаем
      let out = t.replace(
        /(?<![\p{L}\p{N}_])([A-Za-zА-Яа-яЁё]+)-\1(?![\p{L}\p{N}_])/giu,
        (m, word: string) => {
          if (REPEATED_WORD_EXCEPTIONS.includes(word.toLowerCase())) return m;
          count++;
          return word;
        }
      );
      // «в в», «забыл, да, забыл» → одно слово
      const sep = "(?:[ \\t]+|[ \\t]*,[ \\t]*(?:(?:да|ну|типа|короче|блин)[ \\t]*,[ \\t]*)?)";
      const re = new RegExp(
        `(?<![\\p{L}\\p{N}_])([A-Za-zА-Яа-яЁё]+)(?:${sep}\\1(?![\\p{L}\\p{N}_]))+`,
        "giu"
      );
      out = out.replace(re, (m, word: string) => {
        if (REPEATED_WORD_EXCEPTIONS.includes(word.toLowerCase())) return m;
        count += m.toLowerCase().split(word.toLowerCase()).length - 2;
        return word;
      });
      return { text: out, count };
    },
  },
  {
    id: "d-ellipsis",
    category: "defects",
    run: (t) => {
      let count = 0;
      let out = t;
      // Мусор в начале текста: «...,», «,…»
      out = out.replace(/^[ \t]*(?:(?:\.{3}|…|,)[ \t]*)+/, () => {
        count++;
        return "";
      });
      // «—,» → «—», «…,» → «…»
      out = out.replace(/([—–])[ \t]*,(?:[ \t]*,)*/g, (_m, d: string) => {
        count++;
        return d;
      });
      out = out.replace(/(\.{3}|…)[ \t]*,(?:[ \t]*,)*/g, (_m, e: string) => {
        count++;
        return e;
      });
      // Несколько многоточий подряд → одно
      out = out.replace(/(\.{3}|…)(?:[ \t]*(?:\.{3}|…))+/g, (_m, e: string) => {
        count++;
        return e;
      });
      // Многоточие внутри предложения → запятая; слово-повтор после него удаляется
      for (let i = 0; i < 3; i++) {
        const before = out;
        out = out.replace(
          /([A-Za-zА-Яа-яЁё]+)(?:[ \t]*,[ \t]*)?[ \t]*(?:\.{3}|…)[ \t]+([A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)*)/gu,
          (m, prev: string, next: string, offset: number, s: string) => {
            const cut = s.slice(0, offset);
            const lineBefore = cut.slice(cut.lastIndexOf("\n") + 1).trimEnd();
            if (!/[A-Za-zА-Яа-яЁё]$/.test(lineBefore)) return m;
            const recent = (lineBefore + " " + prev).toLowerCase().match(/[A-Za-zА-Яа-яЁё]+(?:-[A-Za-zА-Яа-яЁё]+)*/g) ?? [];
            const recentSet = new Set(recent.slice(-3));
            count++;
            if (next.toLowerCase().split("-").some((p) => recentSet.has(p))) return prev + ",";
            return prev + ", " + next.toLowerCase();
          }
        );
        if (out === before) break;
      }
      return { text: out, count };
    },
  },
  {
    id: "d-hanging-prepositions",
    category: "defects",
    run: (t) => {
      const lines = t.split("\n");
      let count = 0;
      for (let i = 0; i < lines.length - 1; i++) {
        const cur = lines[i];
        const next = lines[i + 1];
        if (!cur.trim() || !next.trim()) continue;
        const words = cur.trim().split(/\s+/);
        const last = words[words.length - 1];
        if (!HANGING_PREPOSITIONS.includes(last.toLowerCase()) || isProtectedToken(last)) continue;
        const nextTrim = next.trim();
        const firstToken = nextTrim.split(/\s+/)[0];
        // Исключения: домены, URL, e-mail, имена файлов, числа
        if (isProtectedToken(firstToken) || /^\d/.test(firstToken)) continue;
        const firstChar = nextTrim[0];
        if (/[a-zа-яё]/.test(firstChar)) {
          // строчная → строки склеиваются
          lines[i] = cur.trimEnd() + " " + nextTrim;
          lines.splice(i + 1, 1);
          count++;
        } else {
          // не строчная (обрыв) → предлог удаляется
          lines[i] = cur.trimEnd().replace(new RegExp(`[ \\t]${last}$`), "");
          count++;
        }
      }
      return { text: lines.join("\n"), count };
    },
  },
  {
    id: "d-punct-space",
    category: "defects",
    run: (t) => {
      let count = 0;
      // пробел перед пунктуацией
      let out = t.replace(/[ \t]+([.,;:!?])/g, (_m, p: string) => {
        count++;
        return p;
      });
      // пробел после пунктуации перед буквой; URL, домены, e-mail, имена
      // файлов защищены (иначе «hh.ru» → «hh. ru»)
      const prot = protectSpans(out);
      out = prot.text.replace(/([.,;:!?])(?=[A-Za-zА-Яа-яЁё])/g, (_m, p: string) => {
        count++;
        return p + " ";
      });
      out = prot.restore(out);
      return { text: out, count };
    },
  },
  {
    id: "d-slash-space",
    category: "defects",
    run: (t) => {
      let count = 0;
      // «и / или» → «и/или»; URL и пути защищены
      const prot = protectSpans(t);
      const out = prot.text.replace(
        /([A-Za-zА-Яа-яЁё0-9])[ \t]*\/[ \t]*([A-Za-zА-Яа-яЁё0-9])/g,
        (m, a: string, b: string) => {
          const replaced = a + "/" + b;
          if (replaced === m) return m;
          count++;
          return replaced;
        }
      );
      return { text: prot.restore(out), count };
    },
  },
  {
    id: "d-repeated-punct",
    category: "defects",
    run: (t) => {
      let count = 0;
      let out = t.replace(/([,;:])\1+/g, (_m, p: string) => {
        count++;
        return p;
      });
      out = out.replace(/!{2,}/g, () => {
        count++;
        return "!";
      });
      out = out.replace(/\?{2,}/g, () => {
        count++;
        return "?";
      });
      out = out.replace(/\.{4,}/g, () => {
        count++;
        return "...";
      });
      out = out.replace(/(?<!\.)\.{2}(?!\.)/g, () => {
        count++;
        return ".";
      });
      out = out.replace(/\(\s*\)/g, () => {
        count++;
        return "";
      });
      return { text: out, count };
    },
  },
  {
    id: "d-empty-markers",
    category: "defects",
    run: (t) => {
      let count = 0;
      // Строки из одних символов-разделителей (OCR/PDF)
      const out = t.replace(/^[ \t]*([-*•—_=])\1{2,}[ \t]*$/gm, () => {
        count++;
        return "";
      });
      return { text: out, count };
    },
  },
];
