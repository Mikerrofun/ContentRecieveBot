import { extractText, getDocumentProxy } from "unpdf";
import { EmptyContentError, ParseError, PdfNoTextLayerError } from "@/shared/lib/errors";

/** Только текстовые PDF; OCR не поддерживается. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: extracted } = await extractText(pdf, { mergePages: true });
    text = extracted;
  } catch (e) {
    // Битый/нечитаемый PDF — ошибка парсинга; пустой текстовый слой —
    // отдельная понятная ошибка про скан (проверяется ниже).
    throw new ParseError(e instanceof Error ? e.message : "неизвестная ошибка");
  }

  if (!text || text.replace(/\s/g, "").length === 0) {
    throw new PdfNoTextLayerError();
  }
  return text;
}
