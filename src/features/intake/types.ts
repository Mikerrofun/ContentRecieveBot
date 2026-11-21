/** Типы приёма материала в сессию. Реализация — в index.ts. */

export interface FileInput {
  buffer: Buffer;
  fileName?: string;
  mime?: string;
}

export interface AudioInput {
  buffer: Buffer;
  fileName: string;
  mime: string;
  kind: "voice" | "audio";
  durationSec?: number;
  label: string;
}
