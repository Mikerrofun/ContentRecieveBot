---
Дата: 23.11.2026
Теги: #features #llm #openrouter #validation #retry
---

# Финальный LLM-проход очистки

## 1. Зачем

Детерминированные правила (`core/cleanup`) убирают мусор: теги, номера страниц,
склейки, паразиты, заикания. Но они не понимают смысл и не трогают
смысловые повторы (тавтологию), кривую пунктуацию и остаточные артефакты речи.
После функций добавлен финальный проход лёгкой моделью через OpenRouter: он
чистит смысл и формулировки, не меняя структуру и не теряя защищённые токены
(URL, e-mail, домены, имена файлов).

## 2. Где/что уже было

Переиспользовано без переписывания:

- `p-queue` — параллельная обработка чанков (паттерн из `features/queue`);
- `core/autofix` + `core/validate` — прогоняются как есть **после** LLM;
- паттерн `onStarted` / «Обрабатываю…» в `bot/lib/finalize-flow.ts`;
- `buildReport` / `renderReport` и `saveMaterial`.

Отрефакторено: локальный цикл повторов в `features/transcribe` переведён на
общий `withRetry` (поведение whisper сохранено: 3 попытки, пауза перед повтором,
хук «Повторяю…»). Константы ретраев whisper переехали в
`features/transcribe/config.ts`.

Не тронуто: `core/cleanup`, `core/validate`, `core/autofix`.

## 3. Реализация

Слои по FSD: `shared/lib/net` — чистый ретрай без знания о домене;
`shared/api/openrouter.ts` — клиент внешнего API; `features/llm-validate` — фича
(чанки, промпт, оркестрация); `features/finalize` — вызывает фичу;
`bot/*` — презентация.

### `shared/lib/net` (ретрай)

- `with-retry.types.ts` — `WithRetryOptions` (attempts, backoff `number |
  number[]`, внешний `signal`, `timeoutMs`, `shouldRetry`, `onAttemptFail`) и
  `RetryableError` со статусом.
- `with-retry.config.ts` — `RETRY_ATTEMPTS = 3`, `RETRY_BACKOFF_MS = 400`.
- `with-retry.ts` — `withRetry(fn, opts)`: гоняет `fn` до `attempts`, пауза по
  `backoff`, ретраит только то, что `shouldRetry` (по умолчанию
  `isRetryableError`) признал временным сбоем; `isRetryableStatus` (408/429/5xx),
  `isRetryableError` (RetryableError без статуса, RetryableError с ретраебельным
  статусом, TypeError сети, таймаут/отмена). Таймаут попытки — через
  `AbortController`, внешний `signal` объединяется с ним.

Вход: `fn(attempt, signal)` и опции. Выход: результат `fn` или последняя ошибка
наверх.

### `shared/api/openrouter.ts` (клиент)

`callChatCompletion({ model, system, user, maxTokens, signal })` — один вызов
`chat/completions`. Возвращает `{ text, model, usage: { input, output } }`.
HTTP-ошибки → `RetryableError` со статусом; сетевые/таймаут → `RetryableError`
без статуса; пустой ответ модели → `RetryableError` без статуса (тоже повод
повторить). Ключ и `LLM_TIMEOUT_MS` — из `shared/config/env.ts`.

### `features/llm-validate` (фича)

- `config.ts` — модели `z-ai/glm-5.3-flash` (основная) и
  `qwen/qwen3.7-flash` (резерв), `PRIMARY_ATTEMPTS = 3`,
  `PRIMARY_BACKOFF_MS = 400`, `GLOBAL_ERROR_STATUSES = {401, 402}`,
  `LLM_CONTEXT_CHARS`, приблизительные цены.
- `prompt.ts` — системный промпт и сборка user-сообщения с read-only контекстом
  соседей.
- `chunk.ts` — `estimateTokens` (грубая оценка) и `splitIntoChunks` (режет по
  пробелам без потерь: `joinChunks(split(x)) === x`), `joinChunks`.
- `index.ts` — типы фичи (`LlmChunk`, `ChunkResult`, `LlmUsageSummary`,
  `LlmValidateResult`) и `llmValidate(text)`: режет на чанки, гонит через
  `p-queue` (concurrency из `LLM_CONCURRENCY`), на каждый чанк `processChunk`:
  `withRetry(GLM)` → при трёх неудачах запроса `Qwen` (без ретраев) → при провале
  обеих моделей откат к исходному тексту чанка. Результаты собираются
  **по индексу чанка**, затем `joinChunks` в исходном порядке. Возвращает
  итоговый текст, разбивку по чанкам, суммарные `usage` и стоимость.

Сохранность URL/e-mail/доменов/имён файлов обеспечивается промптом (модель
получает явное требование копировать их дословно); отдельного guard-слоя нет.

Глобальные ошибки (401/402): `withRetry` не ретраит их, `processChunk`
пробрасывает наверх; прогон помечается `failed`, остальные чанки не стартуют
(проверка флага в начале задачи), текст остаётся после функций.

### Место вызова в `runFinalization`

`features/finalize/index.ts`: после склейки `combined` и первой `validate`, если
`LLM_VALIDATION === "on"` — `llmValidate(combined)`. При успехе `combined`
пересобирается из результата LLM, заново считаются `totalRatio` и `validate`.
Сводка прокидывается в `buildReport` и `saveMaterial`. Сбой LLM не роняет
финализацию.

## 4. UI

- Новая секция отчёта «LLM-прогон»: статус (выполнен / не выполнен), модели и
  число частей по каждой, символы до/после, токены и стоимость.
- Сообщение «Обрабатываю…» удаляется после завершения прогона (в `finally`
  `bot/lib/finalize-flow.ts`, по сохранённому `message_id`).
- Ветка `llm-not-implemented` и `LlmNotImplementedError` удалены.

## 5. Поток данных

```
combined (текст после функций)
  → splitIntoChunks(text, LLM_CHUNK_MAX_TOKENS) [+ контекст соседей]
  → p-queue (concurrency = LLM_CONCURRENCY)
       на каждый чанк:
         withRetry(GLM-5.3-flash)  → ok-primary
         3 неудачи запроса         → Qwen (1 вызов) → ok-fallback
         провал обеих моделей      → reverted (исходный текст чанка)
  → результаты по индексу → joinChunks → текст после LLM
  → autofix + validate → saveMaterial (с LLM-полями) → отчёт «LLM-прогон»
```

## 6. Почему так

- **Чанки.** Один запрос на весь текст упирается в `max_tokens` и теряет
  качество на длинных документах; нарезка сохраняет локальный контекст и
  укладывает каждый чанк в лимит.
- **Параллель через `p-queue`.** Скорость без ручного rate-limit: concurrency
  ограничивает одновременные запросы.
- **Qwen только после трёх неудач GLM.** Экономит стоимость и делает поведение
  предсказуемым: резерв — это страховка, а не основной путь.
- **Результат по индексу.** Параллельные ответы приходят в произвольном
  порядке; запись по индексу сохраняет исходную последовательность текста.
- **Откат при провале.** Если обе модели не ответили (сеть/лимиты/4xx), чанк
  откатывается к исходному тексту — данные не теряются.
- **Сохранность токенов — через промпт.** Модель получает явное требование
  копировать URL/e-mail/домены/имена файлов дословно; отдельный guard-слой не
  вводим, чтобы не усложнять проход.
- **Неудача LLM не роняет финализацию.** Текст остаётся после функций, отчёт
  показывает статус `failed` с причиной.

## 7. Преимущества

- Финальный смысловой проход без переписывания детерминированного ядра.
- Единый `withRetry` для whisper и LLM: одна логика повторов на проект.
- Предсказуемая стоимость: резерв только после исчерпания основной модели.
- Сохранность данных: чанк откатывается к исходнику, если обе модели не ответили.
- Прозрачность: токены, стоимость и статус прогона видны в отчёте и в БД.