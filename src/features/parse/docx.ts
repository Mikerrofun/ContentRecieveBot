import mammoth from "mammoth";
import { EmptyContentError, ParseError } from "@/shared/lib/errors";

/** DOCX → raw text (mammoth). `.doc` не поддерживается. */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  let text: string;
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    text = value;
  } catch (e) {
    throw new ParseError(e instanceof Error ? e.message : "неизвестная ошибка");
  }
  if (!text || text.replace(/\s/g, "").length === 0) {
    throw new EmptyContentError();
  }
  return text;
}
