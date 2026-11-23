-- Финальный LLM-проход очистки: поля прогона (см. docs/llm-validation.md).
-- Дефолты/NULL, чтобы существующие строки материалов не ломались.
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS llm_status TEXT,
  ADD COLUMN IF NOT EXISTS llm_model TEXT,
  ADD COLUMN IF NOT EXISTS llm_input_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_output_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS llm_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.materials.llm_status IS 'Статус LLM-прохода: done | failed | NULL (выключен)';
COMMENT ON COLUMN public.materials.llm_model IS 'Основная модель LLM-прохода';
COMMENT ON COLUMN public.materials.llm_input_tokens IS 'Суммарно входных токенов LLM-прохода';
COMMENT ON COLUMN public.materials.llm_output_tokens IS 'Суммарно выходных токенов LLM-прохода';
COMMENT ON COLUMN public.materials.llm_cost_usd IS 'Оценка стоимости LLM-прохода, USD';