-- Схема БД: валидированный текст сессий (см. docs/database-integration.md).
-- Применяется вручную в SQL Editor Supabase.

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  text text not null,
  chars_before integer not null,
  chars_after integer not null,
  items_count integer not null,
  audio_count integer not null default 0,
  audio_duration_sec integer not null default 0,
  validation_ok boolean not null,
  warnings jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb
);

comment on table public.materials is
  'Валидированный текст одной сессии бота: одна строка на финализацию';

-- RLS без политик: anon/authenticated не видят таблицу вовсе,
-- запись идёт только service key (он RLS обходит).
alter table public.materials enable row level security;
