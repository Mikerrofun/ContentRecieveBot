import type { FileSource } from "@/shared/lib/types";

/** Типы модуля извлечения текста из файлов. Реализация — в index.ts. */

export interface ExtractInput {
  buffer: Buffer;
  fileName?: string;
  mime?: string;
}

export interface ExtractResult {
  text: string;
  source: FileSource;
}
