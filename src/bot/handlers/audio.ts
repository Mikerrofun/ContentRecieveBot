import type { Bot, Context } from "grammy";
import { getEnv } from "@/shared/config/env";
import { AudioTooLongError, FileTooLargeError, TranscriptionError } from "@/shared/lib/errors";
import { messages, formatDuration } from "@/bot/messages";
import { findActiveSession, type Session } from "@/entities/session";
import { acceptAudio } from "@/features/intake";
import { downloadTelegramFile } from "@/bot/lib/download";
import { userMessageFor } from "@/bot/lib/reply";
import { flushPendingTextPrompt, sendAcceptPrompt } from "./prompts";

export interface AudioInput {
  kind: "voice" | "audio";
  fileId: string;
  durationSec?: number;
  /** file_size из метаданных Telegram, если известен. */
  fileSize?: number;
  fileName: string;
  mime: string;
  label: string;
}

/** Общий конвейер для голосовых и аудиофайлов. */
export async function processAudio(
  bot: Bot,
  ctx: Context,
  session: Session,
  input: AudioInput
): Promise<void> {
  const env = getEnv();

  // Длительность известна до скачивания — проверяем сразу
  if (input.durationSec && input.durationSec > env.MAX_AUDIO_MINUTES * 60) {
    const minutes = Math.round((input.durationSec / 60) * 10) / 10;
    await ctx.reply(userMessageFor(new AudioTooLongError(minutes, env.MAX_AUDIO_MINUTES)));
    return;
  }

  // Размер файла тоже известен до скачивания
  if (input.fileSize && input.fileSize > env.MAX_FILE_MB * 1024 * 1024) {
    const sizeMb = Math.round((input.fileSize / (1024 * 1024)) * 10) / 10;
    await ctx.reply(userMessageFor(new FileTooLargeError(sizeMb, env.MAX_FILE_MB)));
    return;
  }

  try {
    const file = await ctx.api.getFile(input.fileId);
    const buffer = await downloadTelegramFile(env.TELEGRAM_BOT_TOKEN, file.file_path ?? "");
    await acceptAudio(session, {
      buffer,
      fileName: input.fileName,
      mime: input.mime,
      kind: input.kind,
      durationSec: input.durationSec,
      label: input.label,
    });
    await sendAcceptPrompt(bot, session);
  } catch (e) {
    if (e instanceof TranscriptionError) {
      await ctx.reply(messages.transcriptionFailed());
    } else {
      await ctx.reply(userMessageFor(e));
    }
  }
}

export function registerVoiceHandler(bot: Bot): void {
  bot.on("message:voice", async (ctx) => {
    const voice = ctx.message.voice;
    const session = findActiveSession(ctx.chat.id);
    if (!session) {
      await ctx.reply(messages.noSession());
      return;
    }
    if (session.status !== "collecting") {
      await ctx.reply(messages.processing());
      return;
    }
    await flushPendingTextPrompt(bot, session);
    await processAudio(bot, ctx, session, {
      kind: "voice",
      fileId: voice.file_id,
      durationSec: voice.duration,
      fileSize: voice.file_size,
      fileName: `voice-${ctx.message.message_id}.oga`,
      mime: "audio/ogg",
      label: `голосовое ${formatDuration(voice.duration)}`,
    });
  });
}

export function registerAudioHandler(bot: Bot): void {
  bot.on("message:audio", async (ctx) => {
    const audio = ctx.message.audio;
    const session = findActiveSession(ctx.chat.id);
    if (!session) {
      await ctx.reply(messages.noSession());
      return;
    }
    if (session.status !== "collecting") {
      await ctx.reply(messages.processing());
      return;
    }
    await flushPendingTextPrompt(bot, session);
    await processAudio(bot, ctx, session, {
      kind: "audio",
      fileId: audio.file_id,
      durationSec: audio.duration,
      fileSize: audio.file_size,
      fileName: audio.file_name ?? `audio-${ctx.message.message_id}.mp3`,
      mime: audio.mime_type ?? "audio/mpeg",
      label: audio.file_name ?? `аудио ${formatDuration(audio.duration)}`,
    });
  });
}
