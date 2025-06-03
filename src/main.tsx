
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import TelegramContestParticipationWebApp from './components/telegram/TelegramContestParticipationWebApp';
import { supabase, genAI } from './api/clients';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  document.body.innerHTML = '<div class="critical-error-container">' +
                              '<h1>Критическая Ошибка</h1>' +
                              '<p>HTML элемент #root не найден.</p>' +
                            '</div>';
} else {
  const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  const geminiApiKeyFromEnv = process.env.API_KEY;

  let criticalError = false;
  let errorMessages: string[] = [];

  if (!supabaseUrl) {
    criticalError = true;
    errorMessages.push("<li>VITE_SUPABASE_URL отсутствует.</li>");
  }
  if (!supabaseAnonKey) {
    criticalError = true;
    errorMessages.push("<li>VITE_SUPABASE_ANON_KEY отсутствует.</li>");
  }
  if (!(geminiApiKeyFromEnv && typeof geminiApiKeyFromEnv === 'string' && geminiApiKeyFromEnv.trim() !== '')) {
    criticalError = true;
    errorMessages.push("<li>GEMINI_API_KEY (для AI) отсутствует или недействителен.</li>");
  }
  
  if (criticalError) {
    rootElement.innerHTML = 
      '<div class="critical-error-container">' +
        '<h1>Критическая Ошибка Конфигурации</h1>' +
        '<p>Обнаружены отсутствующие или неверные переменные окружения:</p>' +
        '<ul>' + errorMessages.join('') + '</ul>' +
        '<p>Проверьте файл .env и конфигурацию сборщика (Vite).</p>' +
      '</div>';
  } else if (!supabase) {
    criticalError = true;
    rootElement.innerHTML = 
      '<div class="critical-error-container">' +
        '<h1>Критическая Ошибка Инициализации</h1>' +
        '<p>Не удалось инициализировать клиент Supabase.</p>' +
      '</div>';
  } else if (!genAI) {
    criticalError = true;
     rootElement.innerHTML = 
      '<div class="critical-error-container">' +
        '<h1>Критическая Ошибка Инициализации</h1>' +
        '<p>Не удалось инициализировать клиент Gemini AI.</p>' +
      '</div>';
  }

  if (!criticalError) {
    try {
      const root = ReactDOM.createRoot(rootElement);
      // Проверяем путь для Telegram Web App
      if (window.location.pathname === '/telegram-webapp/contest-participation') {
        root.render(
          // <React.StrictMode> // StrictMode может вызывать двойной рендер useEffect в разработке
            <TelegramContestParticipationWebApp />
          // </React.StrictMode>
        );
      } else {
        // Рендерим основное приложение
        root.render(
          // <React.StrictMode>
            <App />
          // </React.StrictMode>
        );
      }
    } catch (e: any) {
      rootElement.innerHTML = 
        '<div class="critical-error-container">' +
          '<h1>Ошибка Инициализации Приложения</h1>' +
          '<p>' + (e.message || 'Неизвестная ошибка') + '</p>' +
          '<pre>' + (e.stack || 'Нет стека вызовов') + '</pre>' +
        '</div>';
    }
  }
}
