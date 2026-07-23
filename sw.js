/* Eslovenia 2026 — funcionamiento sin cobertura.
   Guarda la app en el móvil la primera vez que se abre con datos
   y a partir de ahí la sirve desde el propio teléfono. */

const CACHE = "eslovenia26-v1";
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
    caches.match(e.request).then(guardado => {
      const red = fetch(e.request).then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return res;
      }).catch(() => guardado);
      return guardado || red;                    // primero lo guardado: abre al instante
    })
  );
});
