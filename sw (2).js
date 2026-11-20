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

const CACHE = "skill-chronicle-v1";
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
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // One failed download must not stop the rest being saved.
    await Promise.all([new Request("./", { cache: "reload" })].concat(LIBS.map((u) => new Request(u, { mode: "no-cors" }))).map(async (req) => {
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === "opaque")) await cache.put(req, res);
      } catch (e) {}
    }));
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
  if (saved) return saved;
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
