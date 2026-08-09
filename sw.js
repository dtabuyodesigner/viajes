/* Portada de viajes — funcionamiento sin cobertura */

const CACHE = "portada-v10";
const ARCHIVOS = ["./", "./index.html", "./sync.js", "./img/eslovenia-portada.svg"];

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

// La portada puede pedir que el nuevo tome el mando sin esperar
self.addEventListener("message", e => {
  if (e.data && e.data.tipo === "aplicar") self.skipWaiting();
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
     // Maps y la web de Wizz van siempre a la red

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copia));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(g => {
        if (g) return g;
        // el respaldo de la página solo vale para páginas: devolver HTML
        // donde se espera un script rompe la app entera
        if (e.request.destination === "document" || e.request.mode === "navigate")
          return caches.match("./index.html");
        return new Response("", { status: 504, statusText: "sin conexión" });
      }))
  );
});
