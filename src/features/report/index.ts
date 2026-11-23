import type { CleanupStats } from "@/shared/lib/types";
import type { AudioMeta, FinalizeItemResult, ReportInput, ReportSection } from "./types";

export type { AudioMeta, FinalizeItemResult, ReportInput, ReportSection } from "./types";

const CATEGORY_LABELS: Record<keyof CleanupStats, string> = {
  mechanical: "Механика (теги, пробелы, пустые строки)",
  "file-artifacts": "Артефакты файлов (номера страниц, колонтитулы, переносы)",
  defects: "Дефекты (склейки, обрезки слов, пунктуация)",
  speech: "Речь (паразиты, заикание, повторы)",
};

const RULE_LABELS: Record<string, string> = {
  // Механика
  "m-strip": "Обрезка концевых пробелов",
  "m-tags": "Удаление HTML/Markdown тегов",
  "m-html-tags": "Удаление HTML тегов",
  "m-blank-lines": "Удаление пустых строк",
  "m-eol-bom": "Удаление BOM и нормализация переводов строк",
  "m-final-spaces": "Удаление финальных пробелов",
  "m-invisible": "Удаление невидимых символов",
  "m-replacement-char": "Удаление символов замены (�)",
  "m-whitespace": "Нормализация пробелов",
  "m-normalize-final": "Финальная нормализация пробелов",
  // Артефакты файлов
  "f-page-numbers": "Номера страниц",
  "f-headers-footers": "Колонтитулы",
  "f-hard-wraps": "Склейка жёстких переносов внутри абзаца",
  "f-dehyphenate": "Удаление переносов слов",
  "f-toc-dots": "Точки из оглавления",
  // Дефекты
  "d-glue": "Склейка слов (пробелов между словами)",
  "d-truncated": "Обрезки слов",
  "d-punct-space": "Пробелы вокруг пунктуации",
  "d-repeated-punct": "Повторяющаяся пунктуация",
  "d-repeated-words": "Повторы слов",
  "d-ellipsis": "Многоточия и мусорные знаки (…, —,)",
  "d-stutter": "Заикание",
  "d-homoglyphs": "Похожие символы (гомоглифы)",
  "d-empty-markers": "Пустые маркеры списков",
  "d-hanging-prepositions": "Висячие предлоги",
  "d-slash-space": "Пробелы вокруг слэша",
  // Речь
  "s-fillers-always": "Паразиты-заполнители (эээ, ммм, вот)",
  "s-fillers-delimited": "Паразиты с выделением (типа, короче, в общем)",
  "s-punct-fix": "Исправление пунктуации после удаления паразитов",
  "s-elongated": "Растянутые слова (нууу, да-а-а)",
  "d-false-start-dash": "Ложные старты (тире + отмена)",
  "d-false-start-comma": "Ложные старты (запятая + отмена)",
  "d-false-start-fragment": "Ложные старты (обрывки слов)",
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatNumber(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function mergeStats(list: CleanupStats[]): CleanupStats {
  const out: CleanupStats = {
    mechanical: {},
    "file-artifacts": {},
    defects: {},
    speech: {},
  };
  for (const stats of list) {
    for (const category of Object.keys(stats) as (keyof CleanupStats)[]) {
      for (const [id, count] of Object.entries(stats[category])) {
        out[category][id] = (out[category][id] ?? 0) + count;
      }
    }
  }
  return out;
}

/** Отчёт по разделу 11 плана: секции, склеиваемые в сообщения ≤ 4096 символов. */
export function buildReport(input: ReportInput): ReportSection[] {
  const sections: ReportSection[] = [];

  const materials = input.items
    .map((r) => `• ${r.item.label}: ${r.charsBefore} → ${r.charsAfter} симв.`)
    .join("\n");
  const totalBefore = input.items.reduce((n, r) => n + r.charsBefore, 0);
  const totalAfter = input.items.reduce((n, r) => n + r.charsAfter, 0);

  sections.push({
    title: "Материалы",
    body: [
      `Дата: ${formatDateTime(input.createdAt)}`,
      `Элементов: ${input.items.length}`,
      materials,
      `Итого: ${totalBefore} → ${totalAfter} симв.`,
    ].join("\n"),
  });

  const merged = mergeStats(input.items.map((r) => r.stats));
  const statLines: string[] = [];
  
  for (const [category, label] of Object.entries(CATEGORY_LABELS) as [keyof CleanupStats, string][]) {
    const categoryRules = Object.entries(merged[category]).filter(([_, count]) => count > 0);
    if (categoryRules.length === 0) continue;
    
    const total = categoryRules.reduce((sum, [_, count]) => sum + count, 0);
    statLines.push(`\n${label}: ${total} исправлений`);
    
    for (const [ruleId, count] of categoryRules) {
      const ruleName = RULE_LABELS[ruleId] || ruleId;
      statLines.push(`  • ${ruleName}: ${count}`);
    }
  }
  
  const statsBody = statLines.length > 0 
    ? statLines.join("\n") 
    : "Ничего не исправлялось — текст был чистым";
  
  sections.push({ title: "Что исправлено", body: statsBody });

  const audio = input.audio;
  sections.push({
    title: "Аудио",
    body: [
      audio.count > 0
        ? `Записей: ${audio.count}, суммарно ${Math.round(audio.totalDurationSec / 60)} мин`
        : "Аудиозаписей не было",
      audio.provider ? `Провайдер: ${audio.provider}, модель: ${audio.model ?? "—"}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  const validationLines = input.validation.violations.map(
    (v) => `• ${v.criterion} (${v.severity === "warn" ? "предупреждение" : "нарушение"}): ${v.count} — ${v.samples.join(" | ")}`
  );
  sections.push({
    title: "Валидация",
    body: [
      input.validation.ok ? "Статус: чисто" : "Статус: есть замечания",
      ...(validationLines.length > 0 ? ["", ...validationLines] : []),
    ].join("\n"),
  });

  const passes = Math.max(0, ...input.items.map((r) => r.autofixPasses));
  const warnings = input.items.flatMap((r) => r.warnings);
  sections.push({
    title: "Автопочинка",
    body: [
      `Проходов: ${passes}`,
      ...(warnings.length > 0 ? ["Предупреждения:", ...warnings.map((w) => `• ${w}`)] : []),
    ].join("\n"),
  });

  const llm = input.llm;
  if (llm) {
    if (llm.status === "done") {
      const reverted = llm.chunkResults.filter((r) => r.status === "reverted").length;
      const primary = llm.chunkResults.filter((r) => r.status === "ok-primary").length;
      const fallback = llm.chunkResults.filter((r) => r.status === "ok-fallback").length;
      const diff = llm.charsAfter - llm.charsBefore;
      const pct = llm.charsBefore > 0 ? (diff / llm.charsBefore) * 100 : 0;
      sections.push({
        title: "LLM-прогон",
        body: [
          `Статус: выполнен (${llm.chunksTotal - reverted} из ${llm.chunksTotal} частей; ${reverted} без правок)`,
          `Модели: ${llm.primaryModel} — ${primary}, ${llm.fallbackModel} (резерв) — ${fallback}`,
          `После функций: ${formatNumber(llm.charsBefore)} симв.`,
          `После LLM: ${formatNumber(llm.charsAfter)} симв. (${diff >= 0 ? "+" : ""}${formatNumber(diff)}, ${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`,
          `Токены: ${formatNumber(llm.usage.inputTokens)} вход / ${formatNumber(llm.usage.outputTokens)} выход, ~$${llm.usage.costUsd.toFixed(3)}`,
        ].join("\n"),
      });
    } else {
      sections.push({
        title: "LLM-прогон",
        body: [
          "Статус: не выполнен",
          ...(llm.error ? [`Причина: ${llm.error}`] : []),
          "Текст остаётся после функций.",
        ].join("\n"),
      });
    }
  }

  const db = input.db;
  sections.push({
    title: "Запись в БД",
    body: db.ok
      ? [
          "Статус: выполнена",
          `ID записи: ${db.record.id}`,
          `Записано: ${formatDateTime(new Date(db.record.createdAt).getTime())}`,
          `Символов записано: ${input.combinedText.length}`,
        ].join("\n")
      : ["Статус: не выполнена", `Причина: ${db.error}`].join("\n"),
  });

  return sections;
}

const MAX_MESSAGE_LENGTH = 4096;

/** Склейка секций в сообщения ≤ 4096 символов. */
export function renderReport(sections: ReportSection[]): string[] {
  const out: string[] = [];
  let current = "";

  for (const section of sections) {
    const block = (section.title ? `${section.title}\n` : "") + section.body;
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > MAX_MESSAGE_LENGTH) {
      if (current) out.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out;
}
