/* Skill Chronicle offline helper.
   Lets the app open with no signal at all, even from a cold start.

   - The app page itself: always tries the internet first, so a new version
     you upload arrives straight away. Only if there is no answer within a
     few seconds does it use the copy saved on the phone.
   - React, Tailwind, Babel and Supabase's code: these are fixed versions that
     never change, so the saved copy is used first and the internet only if
     it is missing.
   - The database itself (supabase.co) is never touched here. Records still
     come from, and go to, the database exactly as before.

   Must sit next to index.html in the repo, named sw.js. */

const CACHE = "skill-chronicle-v2"; // v1 saved library copies the browser refused; this clears them
// The pinned library versions the page loads (kept here for reference).
const LIBS = [
  "https://unpkg.com/react@18.3.1/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone@7.25.6/babel.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js",
  "https://cdn.tailwindcss.com/3.4.4",
];
const LIB_HOSTS = ["unpkg.com", "cdn.jsdelivr.net", "cdn.tailwindcss.com"];
const PAGE_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  /* Only the page is saved up front. The libraries are saved the first time
     the page itself asks for them, using the page's own request, so the
     saved copy is always in the form the browser will accept. (Version 1
     pre-saved them in a different form, and the browser refused them,
     which stopped the app loading at all.) */
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      const res = await fetch(new Request("./", { cache: "reload" }));
      if (res && res.ok) await cache.put(new URL("./", self.registration.scope).href, res);
    } catch (e) {}
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("skill-chronicle-") && n !== CACHE).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

async function pageFirstFromNetwork(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await withTimeout(fetch(request), PAGE_TIMEOUT_MS);
    if (res && res.ok) {
      // Saved under the plain address, so ?v=7 and ?v=8 share one saved copy.
      await cache.put(new URL("./", self.registration.scope).href, res.clone());
    }
    return res;
  } catch (e) {
    const saved = await cache.match(new URL("./", self.registration.scope).href, { ignoreSearch: true });
    if (saved) return saved;
    throw e;
  }
}

async function libFirstFromCache(request) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(request.url, { ignoreVary: true });
  // A strict ("cors") request cannot be answered with a loose ("opaque") copy.
  if (saved && !(request.mode === "cors" && saved.type === "opaque")) return saved;
  const res = await fetch(request);
  if (res && (res.ok || res.type === "opaque")) await cache.put(request.url, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname.endsWith("supabase.co")) return; // the database: never intercepted
  if (req.mode === "navigate") { event.respondWith(pageFirstFromNetwork(req)); return; }
  if (LIB_HOSTS.indexOf(url.hostname) !== -1) { event.respondWith(libFirstFromCache(req)); return; }
});
