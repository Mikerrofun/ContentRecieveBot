import type { Bot, Context } from "grammy";
import { getEnv } from "@/config/env";
import { messages, formatDuration } from "@/bot/messages";
import { addItem, findActiveSession } from "@/services/session";
import type { Session } from "@/shared/types";
import { transcribeAudio } from "@/ai/whisper";
import { TranscriptionError } from "@/shared/errors";
import { downloadTelegramFile } from "./download";
import { flushPendingTextPrompt, sendAcceptPrompt } from "./prompts";
import { userMessageFor } from "./errors";

export interface AudioInput {
  kind: "voice" | "audio";
  fileId: string;
  durationSec?: number;
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
  const minutes = (input.durationSec ?? 0) / 60;
  // Длительность известна до скачивания — проверяем сразу
  if (input.durationSec && input.durationSec > env.MAX_AUDIO_MINUTES * 60) {
    await ctx.reply(messages.audioTooLong(minutes, env.MAX_AUDIO_MINUTES));
    return;
  }

  try {
    const file = await ctx.api.getFile(input.fileId);
    const buffer = await downloadTelegramFile(env.TELEGRAM_BOT_TOKEN, file.file_path ?? "");
    const { text, provider, model } = await transcribeAudio({
      buffer,
      filename: input.fileName,
      mime: input.mime,
      onAttemptFail: async () => {
        await ctx.reply(messages.transcriptionRetry());
      },
    });
    addItem(session, {
      id: crypto.randomUUID(),
      kind: input.kind,
      label: input.label,
      rawText: text,
      meta: { durationSec: input.durationSec, source: input.kind, provider, model },
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
    if (!session || session.status !== "collecting") {
      await ctx.reply(messages.noSession());
      return;
    }
    await flushPendingTextPrompt(bot, session);
    await processAudio(bot, ctx, session, {
      kind: "voice",
      fileId: voice.file_id,
      durationSec: voice.duration,
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
    if (!session || session.status !== "collecting") {
      await ctx.reply(messages.noSession());
      return;
    }
    await flushPendingTextPrompt(bot, session);
    await processAudio(bot, ctx, session, {
      kind: "audio",
      fileId: audio.file_id,
      durationSec: audio.duration,
      fileName: audio.file_name ?? `audio-${ctx.message.message_id}.mp3`,
      mime: audio.mime_type ?? "audio/mpeg",
      label: audio.file_name ?? `аудио ${formatDuration(audio.duration)}`,
    });
  });
}
