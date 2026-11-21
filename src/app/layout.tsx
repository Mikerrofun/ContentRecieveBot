import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Content Receive Bot",
  description:
    "Телеграм-бот приёма и очистки текста: голосовые, аудио, файлы и текст — на выходе чистый .md и отчёт.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
