/*
 * Service worker de Facilita Gastos: permite que el colaborador abra la app y
 * registre gastos sin conexión.
 *  - Páginas /worker/*: red primero (con tope de espera) y copia guardada de respaldo.
 *  - /_next/static/*: archivos con hash, se guardan y se sirven desde la copia.
 *  - Todo lo demás (API, panel admin, imágenes externas) NO se intercepta: sin red
 *    falla de verdad, y es la app la que decide guardar el gasto en su cola.
 */
const VERSION = 'v3';
const STATIC_CACHE = 'fg-static-' + VERSION;
const PAGES_CACHE = 'fg-pages-' + VERSION;

const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL, '/icon.png'];
const HOME_URL = '/worker/capture';
const DEFAULT_WARM_PAGES = ['/worker/capture', '/worker/history'];
const NAV_NETWORK_TIMEOUT_MS = 4000;
const MAX_STATIC_ENTRIES = 200;

const ASSET_PATTERN = /(?:\/_next\/)?static\/(?:chunks|css|media)\/[^"'\\\s)(<>,;]+?\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|svg|ico)(?:\?[^"'\\\s)(<>,;]+)?/g;
const CSS_RELATIVE_PATTERN = /\.\.\/media\/[^"'\\\s)(<>,;]+?\.(?:woff2?|ttf|otf|png|jpe?g|webp|svg)(?:\?[^"'\\\s)(<>,;]+)?/g;

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names.filter((name) => name !== STATIC_CACHE && name !== PAGES_CACHE).map((name) => caches.delete(name))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'WARM_PAGES') {
        event.waitUntil(warmPages(Array.isArray(data.urls) && data.urls.length ? data.urls : DEFAULT_WARM_PAGES));
    }
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        if (url.pathname === '/' || isWorkerPath(url.pathname)) {
            event.respondWith(handleNavigation(event, url));
        }
        return;
    }

    if (url.pathname.startsWith('/_next/static/') || PRECACHE_URLS.includes(url.pathname)) {
        event.respondWith(cacheFirst(event));
    }
});

function isWorkerPath(pathname) {
    return pathname === '/worker' || pathname.startsWith('/worker/');
}

function pageKey(url) {
    return url.origin + url.pathname.replace(/\/+$/, '');
}

async function handleNavigation(event, url) {
    const pages = await caches.open(PAGES_CACHE);
    const key = pageKey(url);
    const cacheable = isWorkerPath(url.pathname);

    const network = fetch(event.request).then((response) => {
        if (cacheable && response.ok && response.type === 'basic') {
            event.waitUntil(pages.put(key, response.clone()).catch(() => {}));
        }
        return response;
    });

    const cached = cacheable ? await pages.match(key, { ignoreVary: true }) : undefined;

    if (!cached) {
        try {
            return await network;
        } catch (err) {
            return offlineFallback(url);
        }
    }

    // Con señal débil no esperamos a que la red se rinda: pasado el tope, se
    // muestra la copia guardada mientras la red termina en segundo plano.
    let timer;
    const timeout = new Promise((resolve) => {
        timer = setTimeout(() => resolve(null), NAV_NETWORK_TIMEOUT_MS);
    });
    try {
        const response = await Promise.race([network, timeout]);
        if (response) return response;
    } catch (err) {
        return cached;
    } finally {
        clearTimeout(timer);
    }
    event.waitUntil(network.catch(() => {}));
    return cached;
}

async function offlineFallback(url) {
    if (url.pathname === '/' || url.pathname === '/worker') {
        const pages = await caches.open(PAGES_CACHE);
        const home = new URL(HOME_URL, url.origin);
        if (await pages.match(pageKey(home), { ignoreVary: true })) {
            return Response.redirect(home.href, 302);
        }
    }
    return (await caches.match(OFFLINE_URL)) ||
        new Response('Sin conexión', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function cacheFirst(event) {
    const cache = await caches.open(STATIC_CACHE);
    const hit = await cache.match(event.request, { ignoreVary: true });
    if (hit) return hit;

    const response = await fetch(event.request);
    if (response.ok) {
        event.waitUntil(cache.put(event.request, response.clone()).then(() => trimCache(cache)).catch(() => {}));
    }
    return response;
}

async function trimCache(cache) {
    const keys = await cache.keys();
    const excess = keys.length - MAX_STATIC_ENTRIES;
    if (excess > 0) await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

// Descarga las páginas del colaborador y los archivos que usan, para que
// abran sin conexión aunque aún no se hayan visitado en este teléfono.
async function warmPages(urls) {
    const pages = await caches.open(PAGES_CACHE);
    const statics = await caches.open(STATIC_CACHE);
    const assets = new Set();

    for (const raw of urls) {
        let url;
        try {
            url = new URL(raw, self.location.origin);
        } catch (err) {
            continue;
        }
        if (url.origin !== self.location.origin || !isWorkerPath(url.pathname)) continue;

        try {
            const response = await fetch(url.href, { credentials: 'same-origin' });
            // Una redirección (p. ej. sesión vencida → login) no es la página pedida.
            if (!response.ok || response.redirected) continue;
            await pages.put(pageKey(url), response.clone());
            extractAssets(await response.text(), url.href).forEach((href) => assets.add(href));
        } catch (err) {
            // Sin red: se reintenta en la próxima visita con conexión.
        }
    }

    const cssFiles = [];
    await downloadAssets(statics, [...assets], (href, response) => {
        if (/\.css(\?|$)/.test(href)) cssFiles.push({ href, response });
    });

    const fonts = new Set();
    for (const { href, response } of cssFiles) {
        const text = await response.text();
        extractAssets(text, href).forEach((found) => fonts.add(found));
        (text.match(CSS_RELATIVE_PATTERN) || []).forEach((rel) => fonts.add(new URL(rel, href).href));
    }
    await downloadAssets(statics, [...fonts]);
}

function extractAssets(text, baseHref) {
    const found = new Set();
    for (const match of text.match(ASSET_PATTERN) || []) {
        const path = match.startsWith('/_next/') ? match : '/_next/' + match;
        found.add(new URL(path, baseHref).href);
    }
    return [...found];
}

async function downloadAssets(cache, hrefs, onDone) {
    const BATCH = 6;
    for (let i = 0; i < hrefs.length; i += BATCH) {
        await Promise.all(hrefs.slice(i, i + BATCH).map(async (href) => {
            try {
                let response = await cache.match(href, { ignoreVary: true });
                if (!response) {
                    response = await fetch(href);
                    if (!response.ok) return;
                    await cache.put(href, response.clone());
                }
                if (onDone) onDone(href, response.clone());
            } catch (err) {
                // Se reintenta en la próxima visita con conexión.
            }
        }));
    }
    await trimCache(cache);
}
