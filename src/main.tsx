
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { supabase, genAI } from './api/clients';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Критическая Ошибка: HTML элемент #root не найден.</div>`;
} else {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  const geminiApiKeyFromEnv = process.env.API_KEY;

  let criticalError = false;
  let errorMessages: string[] = [];

  if (!supabaseUrl) {
    criticalError = true;
    errorMessages.push("<li>VITE_SUPABASE_URL отсутствует в переменных окружения.</li>");
  }
  if (!supabaseAnonKey) {
    criticalError = true;
    errorMessages.push("<li>VITE_SUPABASE_ANON_KEY отсутствует в переменных окружения.</li>");
  }
  if (!(geminiApiKeyFromEnv && typeof geminiApiKeyFromEnv === 'string' && geminiApiKeyFromEnv.trim() !== '')) {
    criticalError = true;
    errorMessages.push("<li>process.env.API_KEY (для Gemini) отсутствует, пуст или не является строкой. Проверьте конфигурацию Vite (vite.config.ts) и .env файл (GEMINI_API_KEY).</li>");
  }
  
  if (criticalError) {
    rootElement.innerHTML = `
      <div class="critical-error-container">
        <h1>Критическая Ошибка Конфигурации</h1>
        <p>Обнаружены отсутствующие или неверные API ключи или переменные окружения:</p>
        <ul>${errorMessages.join('')}</ul>
        <p>Проверьте ваши переменные окружения (обычно в файле .env) и конфигурацию сборщика (Vite) и перезапустите приложение.</p>
      </div>`;
  } else if (!supabase) {
    criticalError = true;
    rootElement.innerHTML = `
      <div class="critical-error-container">
        <h1>Критическая Ошибка Инициализации Клиента</h1>
        <p>Не удалось инициализировать клиент Supabase. Проверьте консоль для деталей и убедитесь, что URL и Anon ключ Supabase корректны и доступны.</p>
      </div>`;
  } else if (!genAI) {
    criticalError = true;
     rootElement.innerHTML = `
      <div class="critical-error-container">
        <h1>Критическая Ошибка Инициализации Клиента</h1>
        <p>Не удалось инициализировать клиент Gemini AI. Проверьте консоль для деталей и убедитесь, что API ключ Gemini (process.env.API_KEY) корректен и доступен.</p>
      </div>`;
  }


  if (!criticalError) {
    try {
      const root = ReactDOM.createRoot(rootElement);
      root.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
      console.log(
        "%cGameDev Factory%c - Приложение успешно загружено!",
        "font-weight: bold; font-size: 1.2em; color: #007AFF;",
        "font-size: 1em; color: #34C759;"
      );
    } catch (e: any) {
      rootElement.innerHTML = `
        <div class="critical-error-container">
          <h1>Ошибка Инициализации Приложения</h1>
          <p>${e.message}</p>
          <pre>${e.stack}</pre>
        </div>`;
    }
  }
}
