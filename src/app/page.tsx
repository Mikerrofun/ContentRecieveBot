export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 p-8">
      <div className="max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-neutral-200">
        <h1 className="mb-3 text-xl font-semibold text-neutral-50">
          Content Receive Bot
        </h1>
        <p className="text-sm leading-relaxed">
          Телеграм-бот приёма и очистки текста: голосовые расшифровываются,
          файлы парсятся, весь материал чистится и возвращается файлом .md с
          отчётом. Веб-интерфейса нет — работай через Telegram.
        </p>
        <p className="mt-4 text-xs text-neutral-500">
          Health: <code className="text-neutral-400">/api/health</code>
        </p>
      </div>
    </main>
  );
}
