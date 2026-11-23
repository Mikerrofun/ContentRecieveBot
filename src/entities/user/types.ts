/** Сущность «пользователь бота»: профиль Telegram и метки первого /start. */

export interface TelegramUserProfile {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

export interface UserSaveResult {
  ok: boolean;
  /** true — строка вставлена (первый /start), false — обновлён существующий. */
  inserted?: boolean;
  error?: string;
}