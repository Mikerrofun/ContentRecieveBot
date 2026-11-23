/**
 * Оценка токенов и нарезка на чанки. Нарезка без потерь: joinChunks(split(x)) === x,
 * границы проходят по пробелам, защищённые токены не рвутся (они без пробелов).
 */

/** Грубая оценка: ~3.5 символа на токен (смесь кириллицы/латиницы/пробелов). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5);
}

export function splitIntoChunks(text: string, maxTokens: number): string[] {
  if (text.length === 0) return [];
  if (estimateTokens(text) <= maxTokens) return [text];

  const leading = (text.match(/^\s*/) ?? [""])[0];
  const body = text.slice(leading.length);
  const tokens = body.match(/\S+\s*/g) ?? [];
  if (tokens.length === 0) return [text];

  const chunks: string[] = [];
  let current = leading;
  let currentTokens = estimateTokens(leading);

  for (const token of tokens) {
    const tokenTokens = estimateTokens(token);
    if (current.trim().length > 0 && currentTokens + tokenTokens > maxTokens) {
      chunks.push(current);
      current = token;
      currentTokens = tokenTokens;
    } else {
      current += token;
      currentTokens += tokenTokens;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Склейка без потерь: пробелы/переводы строк уже внутри чанков. */
export function joinChunks(parts: string[]): string {
  return parts.join("");
}