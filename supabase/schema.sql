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
  stats jsonb not null default '{}'::jsonb,
  llm_status text,
  llm_model text,
  llm_input_tokens integer not null default 0,
  llm_output_tokens integer not null default 0,
  llm_cost_usd numeric(12, 6) not null default 0
);

comment on table public.materials is
  'Валидированный текст одной сессии бота: одна строка на финализацию';

-- RLS без политик: anon/authenticated не видят таблицу вовсе,
-- запись идёт только service key (он RLS обходит).
alter table public.materials enable row level security;

-- Пользователи бота: запись при первом /start и профиль.
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  language_code text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_users_telegram_id on public.users(telegram_id);

comment on table public.users is
  'Пользователи бота (первый /start и профиль)';

alter table public.users enable row level security;
