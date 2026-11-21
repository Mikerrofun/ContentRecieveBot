import { readFileSync } from "node:fs";
import path from "node:path";
import { getEnv } from "@/shared/config/env";

/**
 * Подсказка для Whisper (~224 токена): стилевой шаблон + словарь терминов.
 * Термины берутся из WHISPER_PROMPT_TERMS (env, через запятую) и/или из
 * файла whisper-terms.txt рядом с этим модулем. Пользователь наполняет
 * словарь сам.
 */
const STYLE_TEMPLATE =
  "Русский язык, правильная пунктуация и заглавные буквы. Разговорный текст о работе и проектах, например: «Мы обсудили план на неделю и решили начать с отчёта по продажам.»";

const MAX_PROMPT_CHARS = 850; // ~224 токена с запасом

function readTermsFile(): string[] {
  try {
    const p = path.join(process.cwd(), "src", "features", "transcribe", "whisper-terms.txt");
    const raw = readFileSync(p, "utf8");
    return raw
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

export function buildWhisperPrompt(): string {
  const env = getEnv();
  const envTerms = env.WHISPER_PROMPT_TERMS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const terms = [...new Set([...envTerms, ...readTermsFile()])];

  let prompt = STYLE_TEMPLATE;
  if (terms.length > 0) {
    prompt += " Термины и названия: " + terms.join(", ") + ".";
  }
  return prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) : prompt;
}
