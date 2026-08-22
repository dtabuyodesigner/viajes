#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   Fotografías del comportamiento de las apps.

   Sirve para mover código sin romper nada:

     node tests/foto.js guardar     antes de tocar nada
     …mover código…
     node tests/foto.js comparar    ¿sale lo mismo?

   Recorre cada app, abre cada pestaña y cada día, y guarda el
   HTML que produce. Si después del cambio el HTML es idéntico,
   el refactor no ha alterado nada visible.

   No es una prueba de que el código sea bueno. Es una prueba
   de que sigue haciendo exactamente lo mismo.
   ═══════════════════════════════════════════════════════════ */

process.env.TZ = "Europe/Madrid";

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const FDB = require("fake-indexeddb");

const RAIZ = path.join(__dirname, "..");
const CARPETA = path.join(__dirname, "fotos");

const verde = t => `\x1b[32m${t}\x1b[0m`;
const rojo  = t => `\x1b[31m${t}\x1b[0m`;
const gris  = t => `\x1b[90m${t}\x1b[0m`;

/* Datos fijos: la fotografía debe salir igual siempre */
const DIARIO = JSON.stringify({
  hechas: { "0:0": 1784000000000 },
  desmarcadas: {},
  notas: { "0": { t: "Una nota de prueba", ts: 1784000000000 } },
  posiciones: { "0:0": { xy: "46.36000,14.11000", ts: 1784000000000 } },
  visitas: [{ id: "vfija", xy: "46.30000,14.50000", ts: 1784000100000,
              dia: 0, txt: "Un sitio" }],
  portadas: {}
});

const VIAJE_PROPIO = JSON.stringify([{
  id: "vfijo", nombre: "Viaje de prueba", desde: "", hasta: "", salida: "León",
  normas: ["Se conduce por la derecha"],
  dias: [{ t: "Día uno", dest: "Zagreb", xy: "45.815,15.982", km: "40 km",
           lluvia: "Un museo",
           paradas: [{ h: "Mañana", txt: "Una parada", n: "Una nota",
                       mapa: "Zagreb", xy: "45.815,15.982", key: true }] }],
  reservas: { vuelos: [{ ruta: "MAD → ZAG", fecha: "1 sep", hora: "18:55",
                         cia: "X", loc: "ABC123", n: "" }],
              coche: { empresa: "Rent", reserva: "R1", recogida: "", devolucion: "",
                       telefono: "+34600000000" },
              telefonos: [{ q: "Hotel", n: "+34611111111" }] }
}]);

const APPS = [
  { id: "portada",   ruta: "index.html",           url: "https://x/",
    almacen: { viajes_propios: VIAJE_PROPIO } },
  { id: "editor",    ruta: "crear/index.html",     url: "https://x/crear/?id=vfijo",
    almacen: { viajes_propios: VIAJE_PROPIO } },
  { id: "visor",     ruta: "viaje/index.html",     url: "https://x/viaje/?id=vfijo",
    almacen: { viajes_propios: VIAJE_PROPIO, diario_vfijo: DIARIO } },
  { id: "eslovenia", ruta: "eslovenia/index.html", url: "https://x/eslovenia/",
    fecha: "2026-07-23T10:00:00", almacen: { diario_eslovenia: DIARIO } },
  { id: "asturias",  ruta: "asturias/index.html",  url: "https://x/asturias/",
    almacen: { diario_asturias: DIARIO } }
];

/* Quita lo que cambia solo y no es comportamiento */
function normaliza(html){
  return String(html)
    // El código no se pinta: comparar el fuente haría saltar la fotografía
    // por un comentario y taparía los cambios que sí importan.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<script></script>")
    .replace(/v\d+ · \d{2}\/\d{2} \d{2}:\d{2}/g, "VERSIÓN")
    .replace(/sync\.js\?v=\d+/g, "sync.js?v=N")
    .replace(/\?v=\d{10,}/g, "?v=T")
    .replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "IMAGEN")
    .replace(/\s+/g, " ")
    .trim();
}

/* ---- Mete en línea los scripts propios, como haría el navegador ----
   Por la etiqueta y no por una lista escrita a mano: así un archivo
   nuevo del que dependa una app (datos.js) entra solo. */
function conScriptsDentro(html, rutaHtml){
  const carpeta = path.posix.dirname(rutaHtml.split(path.sep).join("/"));
  return html.replace(/<script\s+src="([^"]+)"><\/script>/g, (etiqueta, src) => {
    if (/^https?:/.test(src)) return etiqueta;
    const real = path.join(RAIZ, path.posix.normalize(path.posix.join(carpeta, src)));
    if (!fs.existsSync(real)) return etiqueta;
    return `<script>\n${fs.readFileSync(real, "utf8")}\n</script>`;
  });
}

async function retratar(app){
  const html = conScriptsDentro(fs.readFileSync(path.join(RAIZ, app.ruta), "utf8"), app.ruta);

  const almacen = { tema_viajes: "oscuro", ...(app.almacen || {}) };
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url: app.url, pretendToBeVisual: true,
    beforeParse(w){
      Object.defineProperty(w, "localStorage", { value: {
        getItem: k => (k in almacen ? almacen[k] : null),
        setItem: (k, v) => { almacen[k] = String(v); },
        removeItem: k => { delete almacen[k]; }
      }});
      Object.defineProperty(w.navigator, "onLine", { value: false, configurable: true });
      w.matchMedia = () => ({ matches: false, addEventListener(){}, addListener(){} });
      w.indexedDB = new FDB.IDBFactory();
      w.IDBKeyRange = FDB.IDBKeyRange;
      w.navigator.geolocation = { getCurrentPosition: () => {} };  // sin ubicación: reproducible
      w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
      const F = app.fecha || "2026-07-23T10:00:00";
      w.Date = class extends Date {
        constructor(...a){ super(...(a.length ? a : [F])); }
        static now(){ return new Date(F).getTime(); }
      };
    }
  });

  const d = dom.window.document;
  await new Promise(r => setTimeout(r, 900));

  const foto = {};
  const botones = [...d.querySelectorAll("nav button")];

  if (!botones.length){
    foto["_pagina"] = normaliza(d.body.innerHTML);
  } else {
    // La barra de pestañas también cuenta: ahí van sus nombres.
    foto["_pestanas"] = normaliza(d.querySelector("nav")?.innerHTML || "");

    for (const b of botones){
      b.click();
      await new Promise(r => setTimeout(r, 120));
      const v = d.getElementById("v-" + b.dataset.v);
      foto[b.dataset.v] = normaliza(v ? v.innerHTML : "");
      // La cabecera cambia con la pestaña: el título y las fechas del
      // viaje se repintan al cambiar de vista, así que va una por vista.
      foto[b.dataset.v + "-cabecera"] = normaliza(d.querySelector("header")?.innerHTML || "");

      // dentro de Días, abrir cada jornada
      if (b.dataset.v === "dias"){
        const dias = [...d.querySelectorAll("#v-dias .day")];
        for (let k = 0; k < dias.length; k++){
          dias[k].click();
          await new Promise(r => setTimeout(r, 120));
          foto[`dia-${k}`] = normaliza(d.getElementById("detalle")?.innerHTML || "");
        }
      }
    }
  }
  return foto;
}

async function todas(){
  const r = {};
  for (const app of APPS) r[app.id] = await retratar(app);
  return r;
}

(async () => {
  const orden = process.argv[2];
  if (!["guardar", "comparar"].includes(orden)){
    console.log("\n  Uso:\n    node tests/foto.js guardar    antes de tocar nada" +
                "\n    node tests/foto.js comparar   después del cambio\n");
    process.exit(1);
  }

  console.log("\n" + gris("═".repeat(52)));
  console.log(orden === "guardar" ? "  Guardando cómo se comporta ahora"
                                  : "  Comparando con la fotografía anterior");
  console.log(gris("═".repeat(52)) + "\n");

  const ahora = await todas();

  if (orden === "guardar"){
    fs.mkdirSync(CARPETA, { recursive: true });
    for (const [app, vistas] of Object.entries(ahora)){
      fs.writeFileSync(path.join(CARPETA, app + ".json"), JSON.stringify(vistas, null, 1));
      console.log(`  ${verde("✓")} ${app}: ${Object.keys(vistas).length} vistas`);
    }
    console.log(`\n  Guardado en ${gris("tests/fotos/")}. Ahora ya puedes mover código.\n`);
    return;
  }

  if (!fs.existsSync(CARPETA)){
    console.log(rojo("  No hay fotografía previa. Ejecuta primero: node tests/foto.js guardar\n"));
    process.exit(1);
  }

  let cambios = 0, vistas = 0;
  for (const [app, actual] of Object.entries(ahora)){
    const f = path.join(CARPETA, app + ".json");
    if (!fs.existsSync(f)){ console.log(`  ${rojo("✗")} ${app}: sin fotografía previa`); cambios++; continue; }
    const antes = JSON.parse(fs.readFileSync(f, "utf8"));

    const claves = new Set([...Object.keys(antes), ...Object.keys(actual)]);
    const distintas = [];
    for (const k of claves){
      vistas++;
      if (antes[k] !== actual[k]) distintas.push(k);
    }
    if (!distintas.length) console.log(`  ${verde("✓")} ${app}: idéntico`);
    else {
      cambios += distintas.length;
      console.log(`  ${rojo("✗")} ${app}: cambian ${distintas.join(", ")}`);
      // enseñar dónde empieza la diferencia de la primera
      const k = distintas[0];
      const a = antes[k] || "", b = actual[k] || "";
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      console.log(gris(`      en «${k}», a partir del carácter ${i}:`));
      console.log(gris(`      antes:  …${a.slice(Math.max(0,i-40), i+70)}`));
      console.log(gris(`      ahora:  …${b.slice(Math.max(0,i-40), i+70)}`));
    }
  }

  console.log("\n" + gris("─".repeat(52)));
  if (!cambios) console.log(`  ${verde("Se comporta igual")} · ${vistas} vistas comparadas\n`);
  else console.log(`  ${rojo(cambios + " vista(s) cambian")} de ${vistas}\n` +
                   gris("  Si el cambio es intencionado, vuelve a guardar la fotografía.\n"));
  process.exit(cambios ? 1 : 0);
})();
