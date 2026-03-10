const CACHE_NAME = 'facilita-gastos-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // A basic fetch handler is REQUIRED by Chrome to trigger a full modern WebAPK installation
    // Instead of serving offline heavily for now, we just pass through network requests
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('Estás desconectado. Revisa tu conexión a internet.');
        })
    );
});
