import { TranscriptionError } from "@/shared/lib/errors";
import type { TranscriptionProvider } from "../index";

/** Заглушка: локально модели на сервере не запускаем. */
export function createLocalProvider(): TranscriptionProvider {
  return {
    name: "local",
    async transcribe() {
      throw new TranscriptionError("локальный провайдер не реализован");
    },
  };
}
