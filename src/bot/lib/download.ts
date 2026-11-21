import { AppError } from "@/shared/lib/errors";
import { messages } from "@/bot/messages";

/** Скачивание файла через Bot API file/bot<token>/<file_path>. */
export async function downloadTelegramFile(token: string, filePath: string): Promise<Buffer> {
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!res.ok) throw new AppError(messages.downloadFailed());
  return Buffer.from(await res.arrayBuffer());
}
