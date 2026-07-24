/* Asturias occidental — funcionamiento sin cobertura.
   Con red: trae siempre la versión más reciente y la guarda.
   Sin red: sirve lo último que se guardó en el móvil. */

const CACHE = "asturias26-v6";
const ARCHIVOS = ["./", "./index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // Maps y la web de Wizz van siempre a la red

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(g => g || caches.match("./index.html")))
  );
});
