import { runCleanup } from "@/core/cleanup";
import { autofix } from "@/core/autofix";
import { validate } from "@/core/validate";

const SAMPLE = `..., собственно говоря, этот текст примерно на тысячу символов, да-да, именно на 1000 знаков —, вот это да...
И, иду я... Иду-иду... а вокруг бегут, спешат, торопятся
и сразу... Сразу понял: если можно... Просто постоять
забыл, да-да, забыл
ну просто, наверное, я останусь, честное слово
подумать, поразмышлять — и всё
Он сказал ну просто так, вкусного-вкусного не было
чуть-чуть и еле-еле, но да-да, всё же
`;

const opts = { joinHardWraps: true, maxRemovedRatio: 0.4 };

const cleaned = runCleanup(SAMPLE, opts);
console.log("[v0] === runCleanup ===");
console.log(cleaned.text);
console.log("[v0] stats:", JSON.stringify(cleaned.stats));

const fixed = autofix(cleaned.text, opts);
console.log("[v0] === autofix ===");
console.log(fixed.text);
console.log("[v0] passes:", fixed.passes, "ok:", fixed.validation.ok);
console.log("[v0] violations:", JSON.stringify(fixed.validation.violations, null, 2));

console.log("[v0] === validate(clean) ===");
console.log(JSON.stringify(validate(fixed.text, opts), null, 2));

// Регресс-проверки: что НЕ должно пострадать
const GUARDS = [
  ["Ну и ладно, пусть будет так", "Ну и ладно"],
  ["чуть-чуть подождём", "чуть-чуть"],
  ["еле-еле ползёт", "еле-еле"],
  ["СССР и США", "СССР"],
  ["это просто отлично", "просто отлично"],
  ["кстати, о погоде", "кстати"],
  ["или да, или нет", "или да, или нет"],
  ["Он ушёл. Вернулся позже", "Вернулся"],
];
for (const [input, keep] of GUARDS) {
  const out = runCleanup(input, opts).text;
  const ok = out.toLowerCase().includes(keep.toLowerCase());
  console.log(`[v0] guard ${ok ? "OK " : "FAIL"}: "${input}" -> "${out}" (ожидалось сохранить "${keep}")`);
}
