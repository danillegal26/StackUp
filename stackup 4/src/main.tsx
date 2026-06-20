import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Регистрируем сервис-воркер для установки на главный экран (PWA).
// Не блокирует рендер и не критичен — если браузер не поддерживает
// (или это http, не https/localhost), просто тихо ничего не делает.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // установка не удалась — приложение продолжает работать как обычный сайт
    });
  });
}
