# Content Receive Bot

Телеграм-бот приёма и очистки текста: принимает голосовые, аудио, текст и
файлы (pdf, md, txt, docx), чистит материал детерминированными правилами и
возвращает файл `.md` с отчётом. План: `MainPlan-ContentRecieve-Bot.md`.

## Как запустить

### 1. Установить зависимости

```bash
npm install
```

### 2. Заполнить секреты

Скопируй `.env.example` и заполни значения:

- локально (dev) → `.env.development.local`
- прод (Railway) → переменные окружения сервиса

Обязательные секреты: `TELEGRAM_BOT_TOKEN`, `ALLOWED_TELEGRAM_IDS`,
`GROQ_API_KEY` (или `OPENAI_API_KEY` при другом провайдере). Для прод-режима
webhook дополнительно нужны `TELEGRAM_WEBHOOK_SECRET` и `PUBLIC_BASE_URL`.

```bash
cp .env.example .env.development.local
# затем впиши значения
```

### 3. Dev-версия: long polling

На локальной машине бот работает в режиме **long polling** — webhook не
нужен, публичный адрес не нужен, работает за NAT:

```bash
npm run dev:bot
```

Скрипт сам удаляет webhook (`deleteWebhook`) и запускает `bot.start()`.
Параллельно можно поднять веб-каркас (health-страница), он боту не нужен:

```bash
npm run dev
```

### 4. Прод: Railway + webhook

На Railway бот живёт как долгоживущий процесс Next.js (`npm run start`),
принимает апдейты **webhook**-ом:

1. Задеплой репозитория на Railway (Node, `npm ci && npm run build`, start: `npm run start`).
2. Пропиши переменные окружения из `.env.example`, при этом:
   - `BOT_MODE=webhook`
   - `PUBLIC_BASE_URL=https://<твой-домен-railway>` (без слэша на конце)
   - `TELEGRAM_WEBHOOK_SECRET=<openssl rand -hex 32>`
3. Один раз зарегистрируй webhook (можно локально, скрипт ходит в API Telegram):

```bash
npm run set-webhook
```

Проверить/удалить:

```bash
npm run set-webhook -- --delete
```

Важно: **polling и webhook одновременно не работают** — Telegram доставляет
апдейты только одним способом. Переключаясь между dev и продом, запускай
`npm run dev:bot` (сам удаляет webhook) или `npm run set-webhook` (сама
ставит webhook обратно).

## Команды бота

- `/StartProcess` — открыть сессию приёма материала
- `/done` — обработать всё и получить результат (или кнопка «Загрузить в систему»)
- `/cancel` — отменить сессию (с подтверждением, если есть материал)
- `/status` — что уже лежит в сессии
- `/help` — справка

## Скрипты

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Next.js dev-сервер (health, webhook-маршрут) |
| `npm run build` / `npm run start` | прод-сборка и запуск (Railway) |
| `npm run dev:bot` | long polling для локальной разработки |
| `npm run set-webhook` | установить/удалить webhook (`-- --delete`) |
| `npm run check:cleanup` | самопроверка очистки на грязном образце |

## Архитектура

```
src/
  app/                 Next.js (webhook-маршрут, health, страница-заглушка)
  bot/                 grammY: команды, обработчики, клавиатуры, тексты
  services/            сессия (in-memory), очередь, финализация, отчёт, выдача
  core/cleanup/        правила очистки (механика → артефакты → дефекты → речь)
  core/validate/       независимый валидатор критериев V1–V18
  core/autofix.ts      автопочинка по критериям (до 3 проходов)
  parser/              pdf (unpdf), docx (mammoth), md/txt (+windows-1251)
  ai/whisper/          Groq / OpenAI (OpenAI-совместимый API), ретраи
  prompts/             подсказка Whisper + словарь терминов
  config/              env (zod), загрузка env для скриптов
```

Ключевые решения из плана: сессия и очередь в памяти (перезапуск теряет
несохранённое), whitelist по Telegram ID с молчанием для посторонних,
финальный LLM-проход очистки (`LLM_VALIDATION=on`, провайдер OpenRouter) после
детерминированных правил, разбивка на абзацы — заглушка.
