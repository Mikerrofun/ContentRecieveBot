-- Таблица для хранения валидированных материалов из бота
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Текстовый контент
  text TEXT NOT NULL,
  
  -- Метрики
  chars_before INTEGER NOT NULL CHECK (chars_before >= 0),
  chars_after INTEGER NOT NULL CHECK (chars_after >= 0),
  items_count INTEGER NOT NULL CHECK (items_count >= 0),
  audio_count INTEGER NOT NULL DEFAULT 0 CHECK (audio_count >= 0),
  audio_duration_sec NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (audio_duration_sec >= 0),
  
  -- Результаты валидации
  validation_ok BOOLEAN NOT NULL DEFAULT false,
  warnings TEXT[] NOT NULL DEFAULT '{}',
  
  -- Статистика очистки (JSON)
  -- Структура: { "mechanical": {...}, "file-artifacts": {...}, "defects": {...}, "speech": {...} }
  stats JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Индексы для часто используемых запросов
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON public.materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_validation_ok ON public.materials(validation_ok);

-- Комментарии для документации
COMMENT ON TABLE public.materials IS 'Валидированные текстовые материалы из Telegram-бота';
COMMENT ON COLUMN public.materials.text IS 'Очищенный и валидированный текст';
COMMENT ON COLUMN public.materials.chars_before IS 'Количество символов до очистки';
COMMENT ON COLUMN public.materials.chars_after IS 'Количество символов после очистки';
COMMENT ON COLUMN public.materials.items_count IS 'Количество элементов в сессии';
COMMENT ON COLUMN public.materials.audio_count IS 'Количество аудиозаписей';
COMMENT ON COLUMN public.materials.audio_duration_sec IS 'Общая длительность аудио в секундах';
COMMENT ON COLUMN public.materials.validation_ok IS 'Прошла ли валидация без ошибок';
COMMENT ON COLUMN public.materials.warnings IS 'Массив предупреждений валидации';
COMMENT ON COLUMN public.materials.stats IS 'Статистика очистки по категориям (JSONB)';
