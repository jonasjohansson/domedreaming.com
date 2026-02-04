/**
 * Service Worker for Dome Dreaming
 * Caches static assets for faster repeat visits and offline support
 */

// Cache version - automatically updated on each build
// This ensures cache clears on every new push
const CACHE_VERSION = "1770208717941";
const CACHE_NAME = `domedreaming-v${CACHE_VERSION}`;
const RUNTIME_CACHE = `domedreaming-runtime-v${CACHE_VERSION}`;

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/assets/css/main.css",
  "/assets/js/vendor.bundle.js",
  "/assets/js/app.bundle.js",
  "/assets/fonts/OffBit-Regular.woff2",
  "/assets/favicon/favicon-96x96.png",
];

// Bundled assets use cache-first (versioned by SW cache version)
const CACHE_FIRST_ASSETS = [
  "/assets/js/vendor.bundle.js",
  "/assets/js/app.bundle.js",
  "/assets/fonts/OffBit-Regular.woff2",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Caching static assets");
        return cache.addAll(PRECACHE_ASSETS.map((url) => new Request(url, { cache: "reload" })));
      })
      .then(() => {
        // Force activation of new service worker
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("[Service Worker] Cache failed:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              // Delete old caches
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log("[Service Worker] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Strategy: Cache First for bundled assets (versioned by SW), Network First for others
  const isCacheFirstAsset = CACHE_FIRST_ASSETS.some((asset) => url.pathname === asset);

  if (isCacheFirstAsset) {
    // Bundled assets: Cache First (they're versioned by SW cache version)
    event.respondWith(cacheFirst(request));
  } else if (request.url.endsWith(".css") || request.url.endsWith(".js")) {
    // Other CSS and JS: Network First to ensure fresh code and styles
    event.respondWith(networkFirst(request));
  } else if (request.headers.get("accept")?.includes("text/html")) {
    // HTML: Network First with cache fallback
    event.respondWith(networkFirst(request));
  } else if (isStaticAsset(request.url)) {
    // Other static assets (images, fonts, etc.): Cache First
    event.respondWith(cacheFirst(request));
  } else {
    // Other resources: Network First
    event.respondWith(networkFirst(request));
  }
});

/**
 * Check if URL is a static asset (CSS, JS, images, fonts, etc.)
 */
function isStaticAsset(url) {
  return /\.(css|js|jpg|jpeg|png|webp|gif|svg|woff|woff2|ttf|eot|ico|glb|mp4|webm)$/i.test(url);
}

/**
 * Cache First strategy - check cache, fallback to network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error("[Service Worker] Fetch failed:", error);
    // Return offline page or error response
    return new Response("Offline", { status: 503 });
  }
}

/**
 * Network First strategy - try network, fallback to cache
 */
async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log("[Service Worker] Network failed, trying cache:", request.url);

    const cached = await cache.match(request);

    if (cached) {
      return cached;
    }

    // Return offline page for HTML requests
    if (request.headers.get("accept")?.includes("text/html")) {
      const offlinePage = await cache.match("/");
      if (offlinePage) {
        return offlinePage;
      }
    }

    return new Response("Offline", { status: 503 });
  }
}
