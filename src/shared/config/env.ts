import { z } from "zod";

/**
 * Единственный источник конфигурации. Валидируется лениво (при первом вызове
 * getEnv), чтобы `next build` не падал из-за отсутствующих секретов.
 */
const envSchema = z.object({
  // --- Telegram ---
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN обязателен"),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(""),
  ALLOWED_TELEGRAM_IDS: z.string().default(""),
  BOT_MODE: z.enum(["polling", "webhook"]).default("polling"),
  PUBLIC_BASE_URL: z.string().default(""),
  WEBHOOK_PATH: z.string().default("/api/telegram/webhook"),
  PORT: z.coerce.number().int().positive().default(3000),

  // --- Whisper ---
  WHISPER_PROVIDER: z.enum(["groq", "openai", "local"]).default("groq"),
  GROQ_API_KEY: z.string().default(""),
  GROQ_WHISPER_MODEL: z.string().default("whisper-large-v3"),
  OPENAI_API_KEY: z.string().default(""),
  OPENAI_WHISPER_MODEL: z.string().default("whisper-1"),
  WHISPER_PROMPT_TERMS: z.string().default(""),

  // --- Лимиты ---
  MAX_AUDIO_MINUTES: z.coerce.number().positive().default(50),
  MAX_FILE_MB: z.coerce.number().positive().default(20),
  SESSION_TTL_MINUTES: z.coerce.number().positive().default(120),
  MAX_REMOVED_RATIO: z.coerce.number().min(0).max(1).default(0.4),
  JOIN_HARD_WRAPS: z.enum(["pdf", "all", "off"]).default("pdf"),

  // --- Режимы ---
  OUTPUT_MODE: z.enum(["file+report", "report-only"]).default("file+report"),
  CLEANUP_LLM: z.enum(["off", "on"]).default("off"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Некорректная конфигурация окружения:\n${missing}`);
  }

  const env = parsed.data;
  const problems: string[] = [];

  if (env.BOT_MODE === "webhook") {
    if (!env.TELEGRAM_WEBHOOK_SECRET) {
      problems.push("TELEGRAM_WEBHOOK_SECRET обязателен в режиме webhook");
    }
    if (!env.PUBLIC_BASE_URL) {
      problems.push("PUBLIC_BASE_URL обязателен в режиме webhook");
    }
  }
  if (env.WHISPER_PROVIDER === "groq" && !env.GROQ_API_KEY) {
    problems.push("GROQ_API_KEY обязателен при WHISPER_PROVIDER=groq");
  }
  if (env.WHISPER_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
    problems.push("OPENAI_API_KEY обязателен при WHISPER_PROVIDER=openai");
  }

  if (problems.length > 0) {
    throw new Error(`Некорректная конфигурация окружения:\n${problems.join("\n")}`);
  }

  cached = env;
  return env;
}

/** Список разрешённых Telegram ID; пустой список = бот никому не отвечает. */
export function getAllowedTelegramIds(env: Env): Set<number> {
  return new Set(
    env.ALLOWED_TELEGRAM_IDS.split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n > 0)
  );
}
