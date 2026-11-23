# План: финальный LLM-проход очистки (glm-5.3-flash + qwen-3.7-flash резерв)

## 0. Что изучить перед началом

Агент читает эти файлы первыми — по ним понятно устройство проекта и точка, где
будет идти работа. Это не описание задачи, а список для быстрого входа в контекст.

**Конфиг и инфраструктура (shared)**
- `package.json` — стек и скрипты; уже есть `p-queue`, `zod`, `grammy`, `pg`, `tsx`.
- `src/shared/config/env.ts` — единственный источник конфигурации (zod-схема,
  ленивый `getEnv`). Сюда добавим LLM-переменные.
- `src/shared/lib/errors.ts` — иерархия `AppError` с `userMessage`; сюда же
  добавим типизированную ошибку LLM-провайдера (или переиспользуем существующую).
- `src/shared/lib/protect.ts` — `isProtectedToken` / `protectSpans`: что нельзя
  искажать (URL, e-mail, домены, файлы). Нужен для guard-проверок LLM.
- `src/shared/api/supabase.ts` — клиент БД (для понимания, как устроен `shared/api`).

**Доменное ядро (core) — НЕ ТРОГАЕМ, только читаем**
- `src/core/cleanup/index.ts` — `runCleanup` и заглушка `optionalLlmPass = null`
  (её удалим, она больше не нужна).
- `src/core/autofix.ts` — цикл `validate → починка → validate`. После LLM
  прогоняем как есть, заново не пишем.
- `src/core/validate/index.ts` — `validate()`, независимая детекция.

**Фичи (features) — сюда встраиваемся**
- `src/features/transcribe/index.ts` — локальный ретрай с `onAttemptFail` и своим
  backoff `[1000,2000,4000]`. **Не трогаем.** Нужен только как образец «как не
  надо» — у нас будет общий `withRetry` с фиксированным backoff.
- `src/features/transcribe/openai-compatible.ts` — образец вызова внешнего API
  через `fetch` (обработка `!response.ok`, парсинг JSON). Наш `openrouter.ts`
  повторяет этот стиль.
- `src/features/transcribe/types.ts` — образец «типы отдельно от логики».
- `src/features/finalize/index.ts` — `runFinalization`: оркестрация, точка
  вставки LLM-прохода между склейкой и записью в БД.
- `src/features/finalize/types.ts` — `FinalizeOutcome`, `FinalizeHooks`.
- `src/features/report/index.ts` + `types.ts` — сборка секций отчёта и рендер.
- `src/features/queue/index.ts` — как в проекте используют `p-queue` (паттерн
  concurrency и `globalThis`-синглтон).

**Сущности и презентация**
- `src/entities/material/api.ts` + `types.ts` — `saveMaterial`, `MaterialRecordInput`.
- `src/bot/lib/finalize-flow.ts` — презентация: хуки `onStarted/onFailed`,
  сообщение «Обрабатываю…» (`messages.finalizing()`), `switch` по `outcome`.
- `src/bot/lib/sink.ts` — выдача отчёта.
- `src/scripts/check-cleanup.ts` — образец check-скрипта (замена `console`,
  `process.exit`, проверки через массив `[name, boolean]`).

**Документация и БД (образцы для новых файлов)**
- `docs/cleanup-and-validation.md`, `docs/database-integration.md` — шаблон
  «заметки о точечной фиче»: `---` / `Дата` / `Теги` / `---`, разделы
  «Зачем → Где что лежит → … → Почему так».
- `supabase/migrations/20261122_create_materials_table.sql`, `supabase/schema.sql`
  — как оформлены миграции и схема.

---

## 1. Соглашения (соблюдать во всех новых файлах)

Эти правила — часть требований к реализации, не пожелания.

1. **Типы — только в `*.types.ts`.** Никаких `interface`/`type`, объявленных
   рядом с логикой. Логика (`index.ts`, `chunk.ts`, `guards.ts`, `openrouter.ts`)
   импортирует типы из соответствующего `types`-файла.
2. **Константы и конфиги — в `*.config.ts` или `shared/config/env.ts`.**
   Значения, tunable через окружение (`LLM_VALIDATION`, `LLM_CHUNK_MAX_TOKENS`,
   `LLM_CONCURRENCY`, `LLM_TIMEOUT_MS`, `OPENROUTER_API_KEY`) — в `env.ts`.
   Внутренние константы (ID моделей, число попыток, backoff) — в `*.config.ts`.
   В логике чисел и строк «магически» не держим.
3. **Строго по FSD.** `shared/lib/net` — чистые утилиты ретрая без знания о
   домене; `shared/api/openrouter.ts` — клиент внешнего API; `features/llm-validate`
   — фича (чанки, промпт, guards, оркестрация прохода); `features/finalize` —
   вызывает фичу; `bot/*` — только презентация. Слои не смешиваем.
4. **Комментарии — только по важному и неочевидному.** Один-два комментария на
   файл максимум, там где логика не читается с первого взгляда (например, почему
   результат кладётся по индексу, а не по порядку ответов). Не комментируем
   очевидное и не дублируем код комментариями.
5. **Живые запросы к модели НЕ делаем.** Ключ и реальные ответы пользователь
   тестирует сам на своей машине. Мы проверяем типизацию, схемы, FSD и поведение
   на замоканном `fetch` (без сети и без реального ключа).
6. **Минимальные тесты в конце.** Один check-скрипт на несколько ключевых
   сценариев, без перегруза. Не разрастается в тест-фреймворк.

---

## 2. Схема запроса

```
combined (текст после функций)
  ↓ splitIntoChunks(text, maxTokens)      — режем, если токенов > порога
chunks[0..N-1]  (с read-only контекстом соседей)
  ↓ p-queue, concurrency = LLM_CONCURRENCY (4), все чанки стартуют сразу
  ↓ для каждого чанка:
     withRetry(GLM-5.3-flash)             — 3 попытки, backoff 400 мс
       ├─ успех → guard-проверка
       └─ 3 неудачи → ОДИН вызов qwen3.7-flash (без ретраев) → guard-проверка
  ↓ результаты кладутся в массив по индексу чанка (порядок ответов не важен)
  ↓ join(chunks) в исходной последовательности
  ↓ autofix + validate → saveMaterial → отчёт
```

## 3. Решения

- **Модель.** Основная `z-ai/glm-5.3-flash`, в теле запроса одно поле `model`,
  без `models: [...]`. Резервная `qwen/qwen3.7-flash` вызывается только после
  трёх неудач GLM и без своих повторов.
- **Что считается неудачей попытки:** сеть (`TypeError`), таймаут попытки
  (`TimeoutError`/`AbortError`), HTTP 408, 429, 5xx. Плюс пустой/битый ответ при
  HTTP 200 — для LLM это тоже сбой.
- **Fail-fast без повторов:** прочие 4xx сразу наверх. Для чанка это тоже ведёт в
  Qwen, потому что 400 может быть специфичным для модели.
- **Глобальные ошибки** (401 неверный ключ, 402 нет кредитов): Qwen упадёт так же,
  поэтому прогон сразу помечается `failed`, остальные чанки не запускаются —
  иначе впустую тратим 3 попытки × N чанков.
- **Backoff:** фиксированные 400 мс, без экспоненты.
- **Таймаут:** на каждую попытку (`AbortSignal.timeout(LLM_TIMEOUT_MS)` внутри
  попытки). Внешний `AbortSignal` в `withRetry` предусмотрен, но сейчас не
  используется — оставлен для совместимости с шаблоном.
- **Итог по чанку:** `ok-primary`, `ok-fallback` или `reverted` (оба упали или
  guard не прошёл). Попадает в статистику отчёта.

**Три решения по умолчанию** (как рекомендовано; поправьте, если нужно иное):
1. GLM ответил, но не прошёл guard (слишком короткий, потеряны URL) → чанк
   откатывается к исходному тексту **без** вызова Qwen (соблюдаем «Qwen только
   после трёх неудач запроса»).
2. `LLM_VALIDATION` по умолчанию `on` — без `OPENROUTER_API_KEY` бот не стартует
   с понятной ошибкой (как сейчас с Groq).
3. `text_before_llm` в БД **не** добавляем: строка удвоится, метрики и модель
   уже сохраняются.

---

## 4. Что создать и изменить (поток и точки, без кода)

Описание — что делает модуль, что принимает, что отдаёт, на что ссылается.
Конкретные типы/константы живут в `*.types.ts` / `*.config.ts` (см. раздел 1).

### 4.1 Общий слой ретрая — `src/shared/lib/net/` (FSD: shared)
- `with-retry.types.ts` — `WithRetryOptions` (попытки, backoff, внешний
  `AbortSignal`, таймаут, классификатор ошибок), `RetryableError` (ошибка с
  полем статуса/признаком «ретраить»).
- `with-retry.config.ts` — `RETRY_ATTEMPTS = 3`, `RETRY_BACKOFF_MS = 400`.
- `with-retry.ts` — `withRetry(fn, opts)`: гоняет `fn` до `RETRY_ATTEMPTS`, пауза
  `RETRY_BACKOFF_MS`; ретраит только то, что классификатор `isRetryableError`
  (или статус через `isRetryableStatus`) признал временным сбоем; прочие ошибки
  пробрасывает сразу. Плюс `isRetryableStatus` / `isRetryableError`.
  Ссылка на стиль: `features/transcribe/index.ts` (но с фиксированным backoff и
  без `onAttemptFail`), обработка ошибок — как в `openai-compatible.ts`.
- `index.ts` — бочка (реэкспорт публичного API слоя).

### 4.2 Клиент — `src/shared/api/openrouter.ts` (FSD: shared/api)
- `callChatCompletion({ model, system, user, maxTokens, timeoutMs })`: один вызов
  chat/completions на OpenRouter. Возвращает `{ text, model, usage }`. На
  HTTP-ошибках бросает `RetryableError` со статусом (см. 4.1). Ключ и base URL —
  из `shared/config/env.ts`. Стиль — `features/transcribe/openai-compatible.ts`
  (fetch + проверка `response.ok` + парсинг JSON + понятная ошибка при пустом).
  Таймаут — через `AbortSignal.timeout(timeoutMs)` на попытку.

### 4.3 Фича — `src/features/llm-validate/` (FSD: features)
- `types.ts` — все типы фичи: вход/выход `llmValidate`, результат чанка
  (`ok-primary` / `ok-fallback` / `reverted`), сводка по прогону, токен-метрики.
- `config.ts` — ID основной и резервной моделей, прочие внутренние константы.
  Числа, tunable через env, берутся из `shared/config/env.ts`.
- `prompt.ts` — системный промпт (текст промпта, не логика).
- `chunk.ts` — `estimateTokens(text)` (оценка токенов) и `splitIntoChunks(text,
  maxTokens)`: режет без потерь так, чтобы `join(chunks) === исходник`; каждому
  чанку даёт read-only контекст соседей. Опирается на `shared/lib/protect.ts`,
  чтобы не рвать защищённые токены (URL/e-mail/домены).
- `guards.ts` — `guard(chunkBefore, chunkAfter)`: проверяет, что не потеряны
  защищённые токены и что длина не схлопнулась подозрительно. Возвращает
  «прошёл / не прошёл».
- `index.ts` — `llmValidate(text, opts)`: режет на чанки, гонит их через
  `p-queue` (concurrency из `LLM_CONCURRENCY`), на каждый чанк:
  `withRetry(GLM)` → guard → при 3 неудачах запроса `Qwen` (без ретраев) → guard →
  при провале guard/обеих моделей откат к исходному тексту чанка. Результаты
  собирает **по индексу чанка**, затем `join` в исходном порядке. Возвращает
  итоговый текст, разбивку по чанкам, суммарные `usage` и стоимость.
  Паттерн `p-queue` — из `features/queue/index.ts`.

### 4.4 Интеграция (точки вызова и данные)
- `shared/config/env.ts` — добавить: `OPENROUTER_API_KEY`, `LLM_VALIDATION`
  (`on|off`, default `on`), `LLM_CHUNK_MAX_TOKENS=2500`, `LLM_CONCURRENCY=4`,
  `LLM_TIMEOUT_MS=90000`. Схема — рядом с существующими полями.
- `.env.example` — те же переменные с комментариями.
- `features/finalize/index.ts` — между склейкой `combined` и `saveMaterial`
  вставить вызов `llmValidate(combined, …)` (только если `LLM_VALIDATION === "on"`).
  До LLM считаем метрики/длину, после — пересчитываем `validate` и `combined`,
  прокидываем LLM-сводку в отчёт и в `saveMaterial`. Ссылка на текущий порядок
  шагов — в файле (сборка `results` → `combined` → `validate` → `saveMaterial`).
- `features/finalize/types.ts` — расширить `FinalizeOutcome`/результат при
  необходимости (например, статус LLM для презентации); `llm-not-implemented`
  убрать.
- `features/report/index.ts` + `types.ts` — новая секция «LLM-прогон» (см. 5);
  входные типы расширить LLM-сводкой.
- `entities/material/api.ts` + `types.ts` — в `MaterialRecordInput` добавить
  поля LLM-прогона (модель, статус, метрики, токены/стоимость); insert — по
  новым колонкам.
- `bot/lib/finalize-flow.ts` — после завершения прогона удалять сообщение
  «Обрабатываю…» в `finally` (сохранить `message_id` из `onStarted` и вызвать
  `deleteMessage`). Убрать ветку `llm-not-implemented` и импорт
  `LlmNotImplementedError`.
- Удалить `optionalLlmPass` (`core/cleanup/index.ts`) и `LlmNotImplementedError`
  (`shared/lib/errors.ts`).
- `supabase/migrations/20261123_add_llm_validation_to_materials.sql` — новые
  колонки (дефолты/`NULL`, чтобы не ломать существующие строки). Сначала
  проверить фактическую схему (`supabase db query --remote` / SQL Editor), затем
  применить (`supabase db push --remote`). Применение к удалённой БД меняет
  состояние — отдельное подтверждение у пользователя.
- `supabase/schema.sql` — синхронизировать с миграциями.

### 4.5 Документация
- Новый `docs/llm-validation.md` — по шаблону «заметки о точечной фиче»
  (см. 6).
- Правки: `docs/cleanup-and-validation.md` (раздел 9 — ограничения: убрать
  «LLM вне итерации», описать новый проход), `docs/database-integration.md`
  (устарело: `DATABASE_API_SUPABSE` и `supabase-js` — в коде уже `pg`/Postgres;
  поправить раздел 4 и 7), `README.md` (строка про `CLEANUP_LLM`).

---

## 5. Секция отчёта «LLM-прогон»

```
LLM-прогон
Статус: выполнен (7 из 8 частей; 1 часть оставлена без правок)
Модели: z-ai/glm-5.3-flash — 6, qwen/qwen3.7-flash (резерв) — 1
После функций: 48 210 симв.
После LLM: 47 650 симв. (−560, −1,2%)
Токены: 21 400 вход / 17 900 выход, ~$0.004
```

Для статуса `failed` пишем причину и что текст остаётся после функций.

---

## 6. Заметка по фиче: `docs/llm-validation.md`

Пишется **после** реализации и проверки, строго по реальному коду, ничего не
выдумывая. Форма — как у существующих заметок (`cleanup-and-validation.md`,
`database-integration.md`): блок `---` / **Дата:** 23.11.2026 / **Теги:**
`#features #llm #openrouter #validation #retry` / `---`, без wiki-ссылок.
Разделы:
1. **Зачем** — функции чистят мусор, но не смысл; нужен финальный проход лёгкой
   моделью.
2. **Где/что уже было** — переиспользуем `p-queue`, `isProtectedToken`,
   `autofix`/`validate`, паттерн `onStarted`/«Обрабатываю…», `buildReport`/
   `renderReport`, `saveMaterial`. Отметить: локальный ретрай в `transcribe` не
   трогали; `autofix` после LLM не переписывали.
3. **Реализация** — по каждому модулю (`withRetry`, `callChatCompletion`,
   `splitIntoChunks`/`estimateTokens`, `processChunk`, `llmValidate`, `guards`,
   место вызова в `runFinalization`): для чего, вход, выход. Отдельно — что не
   тронуто (`core/cleanup`, `core/validate`, `transcribe`).
4. **UI** — секция «LLM-прогон» и удаление «Обрабатываю…» после завершения.
5. **Поток данных** — ASCII-цепочка через `↓` с аргументами и результатами.
6. **Почему так** — чанки (качество/лимит `max_tokens`); параллель через
   `p-queue` (скорость без rate limit); Qwen только после трёх неудач GLM (цена,
   предсказуемость); результат по индексу (порядок текста не ломается); guard и
   откат (данные не теряются); неудача LLM не роняет финализацию.
7. **Преимущества** — 3–5 пунктов.

---

## 7. Проверка (минимальная, в конце)

Не разрастается в фреймворк; один скрипт по образцу `check-cleanup.ts`.

- `src/scripts/check-llm-validate.ts` — мокает глобальный `fetch` (без сети и без
  реального ключа; в `process.env` кладёт dummy-значения обязательных полей, чтобы
  `getEnv()` прошёл). Минимум сценариев:
  1. разбивка без потерь (`join === исходник`) и порядок после параллельной
     обработки;
  2. 2 сбоя GLM и успех на третьей попытке;
  3. 3 неудачи GLM → ровно один вызов Qwen;
  4. 4xx без ретрая; оба упали → откат чанка;
  5. guard: потеря URL → откат к исходному.
- `package.json` — скрипт `check:llm` (`tsx src/scripts/check-llm-validate.ts`).
- `npx tsc --noEmit` — типизация (главная проверка на нашей стороне).
- `npm run build` — сборка.

**Живой запрос к модели НЕ выполняем** — пользователь тестирует сам на своей
машине со своим `OPENROUTER_API_KEY`.

---

## 8. Порядок работ в Act mode

1. `shared/lib/net` → `shared/api/openrouter.ts` → `features/llm-validate`
   (типы и константы — сразу по `*.types.ts` / `*.config.ts`).
2. `check-llm-validate.ts` на замоканном `fetch`, прогон `check:llm`, затем
   `tsc --noEmit`.
3. Интеграция: `env.ts` + `.env.example`, `features/finalize`, `features/report`,
   `entities/material`, `bot/lib/finalize-flow`. Удалить `optionalLlmPass`,
   `CLEANUP_LLM`, `LlmNotImplementedError`.
4. Миграция: сначала проверка фактической схемы (`supabase db query --remote`),
   затем `supabase db push --remote`. Применение к удалённой БД — только после
   отдельного подтверждения пользователя.
5. `npm run build`.
6. Живой запрос к модели — **на машине пользователя** (не в Act mode).
7. Заметка `docs/llm-validation.md` и правки остальных документов.