
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // Убедитесь, что плагин установлен: npm install -D @vitejs/plugin-react

export default defineConfig(({ mode }) => {
  // Загружаем переменные окружения из .env файла
  // (process as unknown as { cwd: () => string }).cwd() указывает на корневую директорию проекта
  // '' (пустая строка) как третий аргумент загружает все переменные (независимо от префикса VITE_)
  const env = loadEnv(mode, (process as unknown as { cwd: () => string }).cwd(), '');

  return {
    plugins: [react()], // Плагин для поддержки React (JSX, Fast Refresh и т.д.)
    define: {
      // Эта строка сделает process.env.API_KEY доступным в вашем клиентском коде.
      // Vite заменит 'process.env.API_KEY' на фактическое значение переменной GEMINI_API_KEY из вашего .env файла.
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),

      // Переменные Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
      // уже доступны через import.meta.env.VITE_SUPABASE_URL благодаря стандартному поведению Vite,
      // поэтому их не нужно здесь дополнительно определять через process.env.
      // Ваш код index.tsx уже корректно использует import.meta.env для них.
    },
  };
});