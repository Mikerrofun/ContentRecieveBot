import type { CleanupStats } from "@/shared/lib/types";
import type { AudioMeta, FinalizeItemResult, ReportInput, ReportSection } from "./types";

export type { AudioMeta, FinalizeItemResult, ReportInput, ReportSection } from "./types";

/** Короткие подписи категорий правок для сводки «Что исправлено». */
const CATEGORY_SHORT: Record<keyof CleanupStats, string> = {
  mechanical: "Механика",
  "file-artifacts": "Артефакты",
  defects: "Дефекты",
  speech: "Речь",
};

/** Экранирование под HTML parse_mode (на случай динамических строк в отчёте). */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

/** Цена с адаптивной точностью: мелкие суммы не округляются до «0.000». */
function formatCost(n: number): string {
  if (n <= 0) return "$0";
  if (n >= 1) return `$${n.toFixed(3)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(5)}`;
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

/**
 * Сборка отчёта: короткий саммари в HTML (parse_mode HTML). Верх — итог
 * «было → стало» после всей обработки (включая LLM); далее только сухие
 * счётчики: что исправлено, автопочинка, статус+цена LLM, номер записи в БД.
 */
export function buildReport(input: ReportInput): ReportSection[] {
  const sections: ReportSection[] = [];

  const totalBefore = input.items.reduce((n, r) => n + r.charsBefore, 0);
  const totalAfter = input.combinedText.length;

  sections.push({
    body: [
      `<b>Готово</b> · ${formatDateTime(input.createdAt)}`,
      `Было <b>${formatNumber(totalBefore)}</b> → стало <b>${formatNumber(totalAfter)}</b> симв.`,
    ].join("\n"),
  });

  const merged = mergeStats(input.items.map((r) => r.stats));
  const parts: string[] = [];
  for (const category of Object.keys(CATEGORY_SHORT) as (keyof CleanupStats)[]) {
    const total = Object.values(merged[category]).reduce((sum, count) => sum + count, 0);
    if (total > 0) parts.push(`${CATEGORY_SHORT[category]}: ${total}`);
  }
  sections.push({
    title: "Что исправлено",
    body: parts.length > 0 ? parts.join(" · ") : "Ничего не исправлялось",
  });

  const passes = Math.max(0, ...input.items.map((r) => r.autofixPasses));
  const warnings = input.items.flatMap((r) => r.warnings);
  sections.push({
    title: "Автопочинка",
    body: [
      `Проходов: ${passes}`,
      ...(warnings.length > 0 ? ["Предупреждения:", ...warnings.map((w) => `• ${escapeHtml(w)}`)] : []),
    ].join("\n"),
  });

  const llm = input.llm;
  if (llm) {
    const status = llm.status === "done" ? "Выполнен" : "Не выполнен";
    // Модель, которая реально сделала правку: если хоть один чанк ушёл в резерв —
    // это qwen, иначе основная (deepseek). Метка — вендор до «/».
    const modelId = llm.chunkResults.some((r) => r.status === "ok-fallback")
      ? llm.fallbackModel
      : llm.primaryModel;
    const label = modelId.split("/")[0];
    sections.push({ title: "LLM", body: `${status} · ${label} · ${formatCost(llm.usage.costUsd)}` });
  }

  const db = input.db;
  sections.push({
    title: "Запись в БД",
    body: db.ok
      ? `Выполнена · <code>${escapeHtml(db.record.id)}</code>`
      : `Не выполнена${db.error ? ` · ${escapeHtml(db.error)}` : ""}`,
  });

  return sections;
}

const MAX_MESSAGE_LENGTH = 4096;

/**
 * Склейка секций в сообщения ≤ 4096 символов. Секции самодостаточны (HTML-теги
 * не разрываются между сообщениями), поэтому режем только по границам секций.
 */
export function renderReport(sections: ReportSection[]): string[] {
  const blocks = sections.map((s) => (s.title ? `<b>${s.title}</b>\n${s.body}` : s.body));
  const out: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length > MAX_MESSAGE_LENGTH && current) {
      out.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out;
}