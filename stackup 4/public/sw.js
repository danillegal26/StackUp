const CACHE_NAME = 'stackup-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Кэшируем только статику самого приложения (тот же origin, GET).
// Supabase-запросы (другой домен, REST/Realtime) сюда не попадают и всегда
// идут напрямую в сеть — без сети игра всё равно не имеет смысла (нужна
// синхронизация между телефонами), кэш нужен только для мгновенной
// загрузки оболочки приложения и небольшой устойчивости к обрывам связи.
// Стратегия «сеть, потом кэш» (не «кэш, потом сеть»): после каждого
// деплоя пользователь должен получать свежий код, а не старую версию.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
      }
    })
  );
});
