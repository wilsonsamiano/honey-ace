/* Honey Ace offline cache — first visit stores the shell, sprites, and scripts. */
const CACHE = "honey-ace-offline-v2";
const BUILD_ASSETS = /* __BUILD_ASSETS__ */ [];

const PRECACHE = [
  "/",
  ...BUILD_ASSETS,
  "/favicon.svg",
  "/mascot.png",
  "/__grok/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/__grok/manifest.webmanifest",
  "/sprites/player.png",
  "/sprites/bird.png",
  "/sprites/wasp.png",
  "/sprites/frog.png",
  "/sprites/pig.png",
  "/sprites/cat.png",
  "/sprites/boss.png",
  "/sprites/boss-owl.png",
  "/sprites/boss-queen.png",
  "/sprites/boss-whale.png",
  "/sprites/boss-peach.png",
  "/sprites/boss-mecha.png",
  "/sprites/shot.png",
  "/sprites/missile.png",
  "/sprites/pellet.png",
  "/sprites/boom.png",
  "/sprites/bell.png",
  "/sprites/shield.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;
  event.waitUntil(cacheUrls(data.urls));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheUrls(urls) {
  const cache = await caches.open(CACHE);
  await Promise.all(
    urls.map(async (raw) => {
      try {
        const url = new URL(raw, self.location.origin);
        if (url.origin !== self.location.origin) {
          if (
            url.hostname !== "fonts.googleapis.com" &&
            url.hostname !== "fonts.gstatic.com"
          ) {
            return;
          }
        }
        const res = await fetch(url.href, { credentials: "same-origin" });
        if (res.ok) await cache.put(url.href, res);
      } catch {
        /* skip */
      }
    }),
  );
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok || fresh.type === "opaque") {
      await cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put(request, fresh.clone());
    return fresh;
  } catch {
    return (
      (await cache.match(request)) ||
      (await cache.match("/")) ||
      new Response("Honey Ace is offline.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}
