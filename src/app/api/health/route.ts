/** Health-check для мониторинга/Railway. Не требует валидного env. */
export function GET(): Response {
  return Response.json({
    ok: true,
    mode: process.env.BOT_MODE ?? "unknown",
  });
}
