import dotenv from "dotenv";

/**
 * Загрузка env для TS-скриптов (tsx не читает .env сам).
 * Next.js загружает эти файлы самостоятельно для webhook-маршрута.
 */
export function loadEnvForScripts(): void {
  dotenv.config(); // .env — базовые значения
  dotenv.config({ path: ".env.development.local", override: true }); // локальные поверх
  dotenv.config({ path: ".env.local", override: true });
}
