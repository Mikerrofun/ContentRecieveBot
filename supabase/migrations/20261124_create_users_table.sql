-- Пользователи бота: запись при первом /start и хранение профиля.
-- Повторные /start обновляют профиль и last_seen_at, не плодя дубликаты.
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  language_code TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);

COMMENT ON TABLE public.users IS 'Пользователи бота (первый /start и профиль)';
COMMENT ON COLUMN public.users.telegram_id IS 'Telegram user id (уникальный)';
COMMENT ON COLUMN public.users.first_seen_at IS 'Когда пользователь впервые нажал /start';
COMMENT ON COLUMN public.users.last_seen_at IS 'Когда пользователь последний раз нажал /start';