import { UnsupportedFormatError } from "@/shared/lib/errors";
import { extractPdfText } from "./pdf";
import { extractDocxText } from "./docx";
import { extractPlainText } from "./text";
import type { ExtractInput, ExtractResult } from "./types";

export type { ExtractInput, ExtractResult } from "./types";

function extensionOf(input: ExtractInput): string {
  const fromName = input.fileName?.split(".").pop()?.toLowerCase() ?? "";
  if (fromName) return fromName;
  const mime = input.mime ?? "";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";
  if (mime.includes("plain")) return "txt";
  if (mime.includes("markdown")) return "md";
  return "";
}

/** Точка входа парсера: buffer + mime/ext → текстовый слой. */
export async function extractText(input: ExtractInput): Promise<ExtractResult> {
  const ext = extensionOf(input);

  if (ext === "pdf") {
    return { text: await extractPdfText(input.buffer), source: "pdf" };
  }
  if (ext === "docx") {
    return { text: await extractDocxText(input.buffer), source: "docx" };
  }
  if (ext === "md" || ext === "markdown" || ext === "txt") {
    return { text: extractPlainText(input.buffer), source: ext === "txt" ? "txt" : "md" };
  }

  // .doc и прочее — явно не поддерживаем (план: mammoth умеет только .docx)
  throw new UnsupportedFormatError();
}

export { extractPdfText, extractDocxText, extractPlainText };
