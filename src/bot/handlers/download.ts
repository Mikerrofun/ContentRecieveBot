import { AppError } from "@/shared/errors";

/** Скачивание файла через Bot API file/bot<token>/<file_path>. */
export async function downloadTelegramFile(token: string, filePath: string): Promise<Buffer> {
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  if (!res.ok) throw new AppError("Не удалось скачать файл из Telegram, попробуй ещё раз");
  return Buffer.from(await res.arrayBuffer());
}
