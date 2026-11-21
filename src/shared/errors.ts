/** Базовая ошибка с понятным пользователю сообщением (текст в messages.ts не дублируем). */
export class AppError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string) {
    super(userMessage);
    this.name = new.target.name;
    this.userMessage = userMessage;
  }
}

export class UnsupportedFormatError extends AppError {
  constructor() {
    super("Формат не поддерживается. Могу: pdf, md, txt, docx, голосовые и аудио");
  }
}

export class FileTooLargeError extends AppError {
  constructor(sizeMb: number, limitMb: number) {
    super(`Файл слишком большой (${sizeMb} МБ, лимит ${limitMb})`);
  }
}

export class AudioTooLongError extends AppError {
  constructor(minutes: number, limitMinutes: number) {
    super(
      `Запись длиннее ${limitMinutes} минут (${minutes} мин). Раздели её на две части и отправь снова`
    );
  }
}

export class TranscriptionError extends AppError {
  constructor(detail = "не удалось расшифровать аудио") {
    super(`Не удалось расшифровать: ${detail}`);
  }
}

export class ParseError extends AppError {
  constructor(detail: string) {
    super(`Не удалось прочитать файл: ${detail}`);
  }
}

export class EmptyContentError extends AppError {
  constructor(message = "В материале не нашлось текста") {
    super(message);
  }
}

export class PdfNoTextLayerError extends EmptyContentError {
  constructor() {
    super("В PDF нет текстового слоя, сканы не поддерживаются");
  }
}

export class SessionNotFoundError extends AppError {
  constructor() {
    super("Сначала вызови /StartProcess");
  }
}

export class LlmNotImplementedError extends AppError {
  constructor() {
    super("LLM-очистка не реализована в этой итерации (CLEANUP_LLM=on не поддерживается)");
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
