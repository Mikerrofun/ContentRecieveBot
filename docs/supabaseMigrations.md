# Supabase Database Setup

## Создание новых миграций

### Автоматически через CLI

```bash
# Создаёт новый файл миграции с timestamp
supabase migration new <название_миграции>

# Например:
supabase migration new add_user_id_to_materials
```

Это создаст файл `supabase/migrations/YYYYMMDDHHMMSS_add_user_id_to_materials.sql`

### Вручную

Просто создайте SQL файл в `supabase/migrations/` с именем:
```
YYYYMMDDHHMMSS_описание.sql
```

Формат даты: `YYYYMMDD` + время (опционально)

Пример: `20261123_add_indexes.sql`

## Применение миграций

### Через Supabase CLI (рекомендуется)

```bash
# 1. Установка CLI (если еще не установлен)
npm install -g supabase

# 2. Авторизация (один раз)
supabase login

# 3. Подключение к проекту (один раз)
cd /Users/admin/Mikerrofun/FullStack/Projects/ContentRecieveBot
supabase link --project-ref dnwpauigkoblfncvjtjo

# 4. Применение всех новых миграций
supabase db push --remote
```

**Преимущества CLI:**
- ✅ Автоматическое применение всех новых миграций из `supabase/migrations/`
- ✅ Версионирование и отслеживание применённых миграций
- ✅ Возможность отката (rollback)
- ✅ Не нужно копировать SQL вручную

### Через Supabase Dashboard (альтернатива)

Если по какой-то причине CLI недоступен:

1. Откройте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейдите в **SQL Editor** (слева в меню)
3. Нажмите **New query**
4. Скопируйте содержимое файла из `supabase/migrations/`
5. Вставьте в редактор и нажмите **Run**

## Структура таблицы materials

```sql
CREATE TABLE public.materials (
  id UUID PRIMARY KEY,
  created_at TIMESTAMPTZ,
  text TEXT,
  chars_before INTEGER,
  chars_after INTEGER,
  items_count INTEGER,
  audio_count INTEGER,
  audio_duration_sec NUMERIC(10, 2),
  validation_ok BOOLEAN,
  warnings TEXT[],
  stats JSONB
);
```

## Проверка

После применения миграции проверьте таблицу:

```sql
SELECT COUNT(*) FROM public.materials;
```

Должно вернуть `0` (таблица пустая, но существует).

## RLS (Row Level Security)

⚠️ **Важно**: Если вы используете service_role ключ (как сейчас), RLS не применяется.

Если планируете использовать anon/authenticated ключи, добавьте политики:

```sql
-- Включить RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Политика: чтение всем аутентифицированным
CREATE POLICY "Allow authenticated read" 
  ON public.materials FOR SELECT 
  TO authenticated 
  USING (true);

-- Политика: запись только service_role (через env)
-- При использовании service_role ключа дополнительные политики не нужны
```

## Быстрые команды

### Применить все новые миграции
```bash
supabase db push --remote
```

### Создать новую миграцию
```bash
supabase migration new my_migration_name
```

### Проверить статус миграций
```bash
supabase migration list
```

### Выполнить SQL запрос
```bash
supabase db query --remote "SELECT * FROM public.materials LIMIT 10;"
```

### Проверить записи в таблице
```bash
supabase db query --remote "SELECT id, created_at, chars_after, validation_ok FROM materials ORDER BY created_at DESC LIMIT 5;"
```

## Настройка окружения

### Правильные значения для .env

Из Supabase Dashboard (**Settings** → **Database** → **Connection string**):

```env
# Transaction pooler (для приложения)
DATABASE_URL="postgresql://postgres.dnwpauigkoblfncvjtjo:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true"

# Session pooler (для миграций, опционально)
DIRECT_URL="postgresql://postgres.dnwpauigkoblfncvjtjo:[YOUR-PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
```

**Где взять:**
1. Откройте https://supabase.com/dashboard/project/dnwpauigkoblfncvjtjo
2. Settings → Database
3. Найдите раздел **Connection string**
4. Скопируйте **Transaction** или **Session** pooler
5. Замените `[YOUR-PASSWORD]` на пароль вашей базы данных

⚠️ **Если забыли пароль:**
- Settings → Database → Reset Database Password
- ⚠️ После сброса все существующие подключения перестанут работать!

⚠️ **Частые ошибки:**

1. ❌ Забыли заменить `[YOUR-PASSWORD]` → authentication failed
2. ❌ Использовали HTTPS URL вместо postgresql:// → Invalid connection string
3. ❌ Не установлен пакет `pg` → Cannot find module 'pg'

## Структура папки supabase/

- `migrations/` — SQL файлы миграций (версионируются в git)
- `.temp/` — временные файлы CLI (не в git, см. `.gitignore`)
- `schema.sql` — снимок текущей схемы БД

## Workflow для новых миграций

1. **Создать миграцию:**
   ```bash
   supabase migration new add_feature_x
   ```

2. **Отредактировать созданный SQL файл** в `supabase/migrations/`

3. **Применить миграцию:**
   ```bash
   supabase db push --remote
   ```

4. **Закоммитить миграцию в git:**
   ```bash
   git add supabase/migrations/
   git commit -m "Add migration: add_feature_x"
   ```

## Тестирование интеграции

После применения миграции запустите бота и отправьте материалы:

```bash
npm run dev:bot
```

В отчёте финализации должно быть:
```
Запись в БД
Статус: выполнена ✓
ID записи: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Проверить записи:
```bash
supabase db query --remote "SELECT * FROM materials ORDER BY created_at DESC LIMIT 1;"
```
