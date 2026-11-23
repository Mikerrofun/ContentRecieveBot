/** Внутренние константы ретраев расшифровки (whisper). */

export const TRANSCRIBE_RETRY_ATTEMPTS = 3;
export const TRANSCRIBE_RETRY_BACKOFF_MS = [1000, 2000, 4000];

/** Лимит Whisper API на размер файла (план 6.4). */
export const WHISPER_MAX_FILE_MB = 25;