import { extractText, getDocumentProxy } from "unpdf";
import { EmptyContentError, PdfNoTextLayerError } from "@/shared/errors";

/** Только текстовые PDF; OCR не поддерживается. */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: extracted } = await extractText(pdf, { mergePages: true });
    text = extracted;
  } catch (e) {
    throw new EmptyContentError(
      e instanceof Error ? `Не удалось прочитать PDF: ${e.message}` : "В PDF нет текстового слоя, сканы не поддерживаются"
    );
  }

  if (!text || text.replace(/\s/g, "").length === 0) {
    throw new PdfNoTextLayerError();
  }
  return text;
}
