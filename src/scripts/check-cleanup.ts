/**
 * Самопроверка очистки: грязный образец со всеми типами дефектов →
 * очистка → автопочинка → валидатор должен дать ok. Плюс проверки
 * сохранности доменов/URL/e-mail/чисел и идемпотентности.
 */
import { loadEnvForScripts } from "@/shared/config/loadEnv";

const DIRTY_SAMPLE = [
  "\uFEFFЗаголовок отчёта<br><u>черновик</u>",
  "   ",
  " Привет , мы  обсудили&amp;план . ",
  "наCAC и привеT — это тест гомоглифов.",
  "ну, мы как бы сделали, типа, отчёт",
  "эээ ну-у хм короче, всё  готово..",
  "по-по-посмотрим и пробле- проблема решена",
  "Раздел ........ 12",
  "12 / 40",
  "--------------------",
  "Страница отчёта",
  "Страница отчёта",
  "Страница отчёта",
  "Мы положили документы",
  "на",
  "стол и ушли. Встреча в 12:30, доля 3.5%.",
  "Смотри hh.ru и https://example.com/page, пиши на user@example.com.",
  "и / или какой- то вариант",
  "\u200Bневидимый\u00ADсимвол\uFFFD",
  "",
  "",
  "",
].join("\n");

async function main(): Promise<void> {
  loadEnvForScripts();
  const { runCleanup } = await import("@/core/cleanup");
  const { autofix } = await import("@/core/autofix");
  const { validate } = await import("@/core/validate");

  const opts = { joinHardWraps: true, maxRemovedRatio: 0.4 };

  const cleaned = runCleanup(DIRTY_SAMPLE, opts);
  const fixed = autofix(cleaned.text, opts);
  const final = fixed.text;

  const validation = validate(final, {
    removedRatio: fixed.removedRatio,
    maxRemovedRatio: opts.maxRemovedRatio,
  });

  const checks: Array<[string, boolean]> = [
    ["валидатор: ok", validation.ok],
    ["сохранён домен hh.ru", final.includes("hh.ru")],
    ["сохранён URL", final.includes("https://example.com/page")],
    ["сохранён e-mail", final.includes("user@example.com")],
    ["сохранено время 12:30", final.includes("12:30")],
    ["сохранено число 3.5", final.includes("3.5")],
    ["идемпотентность: clean(clean(x)) === clean(x)", runCleanup(final, opts).text === final],
  ];

  // eslint-disable-next-line no-console
  console.log("=== Результат очистки ===");
  // eslint-disable-next-line no-console
  console.log(final);
  // eslint-disable-next-line no-console
  console.log("\n=== Проверки ===");
  let failed = false;
  for (const [name, passed] of checks) {
    // eslint-disable-next-line no-console
    console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
    if (!passed) failed = true;
  }

  if (validation.violations.length > 0) {
    // eslint-disable-next-line no-console
    console.log("\nНарушения:", JSON.stringify(validation.violations, null, 2));
  }

  process.exit(failed ? 1 : 0);
}

void main();
