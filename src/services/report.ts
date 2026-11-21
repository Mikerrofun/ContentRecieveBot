import type { AudioMeta, CleanupStats, FinalizeItemResult, ValidationResult } from "@/shared/types";

export interface ReportSection {
  title?: string;
  body: string;
}

const CATEGORY_LABELS: Record<keyof CleanupStats, string> = {
  mechanical: "Механика (теги, пробелы, пустые строки)",
  "file-artifacts": "Артефакты файлов (номера страниц, колонтитулы, переносы)",
  defects: "Дефекты (склейки, обрезки слов, пунктуация)",
  speech: "Речь (паразиты, заикание, повторы)",
};

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

export interface ReportInput {
  createdAt: number;
  items: FinalizeItemResult[];
  combinedText: string;
  validation: ValidationResult;
  audio: AudioMeta;
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
    const total = Object.values(merged[category]).reduce((a, b) => a + b, 0);
    statLines.push(`• ${label}: ${total}`);
  }
  sections.push({ title: "Что исправлено", body: statLines.join("\n") });

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

  sections.push({
    title: "Разбивка на абзацы",
    body: "Не выполнялась (заглушка, раздел 8.4 плана).",
  });

  return sections;
}

const MAX_MESSAGE_LENGTH = 4096;

/** Склейка секций в сообщения ≤ 4096 символов. */
export function renderReport(sections: ReportSection[]): string[] {
  const out: string[] = [];
  let current = "";

  for (const section of sections) {
    const block = (section.title ? `**${section.title}**\n` : "") + section.body;
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
