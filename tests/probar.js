#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   Pruebas de las apps de viajes.

   Uso:  node tests/probar.js
   Sale con código 1 si algo falla, para poder encadenarlo.

   Comprueba, sin tocar la red ni GitHub:
   · Que cada app carga sin errores de JavaScript
   · Que todas las pestañas pintan contenido
   · Que los enlaces son de un esquema válido
   · Que el editor guarda, importa y exporta
   · Que la sincronización aguanta sin sesión y sin conexión
   ═══════════════════════════════════════════════════════════ */

const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RAIZ = path.join(__dirname, "..");
let fallos = 0, pruebas = 0;

const verde = t => `\x1b[32m${t}\x1b[0m`;
const rojo  = t => `\x1b[31m${t}\x1b[0m`;
const gris  = t => `\x1b[90m${t}\x1b[0m`;

function comprobar(desc, condicion, detalle){
  pruebas++;
  if (condicion) console.log(`  ${verde("✓")} ${desc}`);
  else { fallos++; console.log(`  ${rojo("✗")} ${desc}${detalle ? gris("  → " + detalle) : ""}`); }
}

/* ---- Monta una app en un navegador simulado ---- */
function abrir(rutaHtml, opciones = {}){
  const {
    url = "https://dtabuyodesigner.github.io/viajes/",
    almacen = {},
    conexion = true,
    sesion = null,
    fecha = null,
    posicion = null,
    respuestaFetch = null
  } = opciones;

  let html = fs.readFileSync(path.join(RAIZ, rutaHtml), "utf8");
  // sync.js se inyecta en línea, como haría el navegador
  const sync = fs.readFileSync(path.join(RAIZ, "sync.js"), "utf8");
  html = html.replace(/<script src="[^"]*sync\.js[^"]*"><\/script>/,
                      `<script>\n${sync}\n</script>`);

  const errores = [];
  const dom = new JSDOM(html, {
    runScripts: "dangerously", url, pretendToBeVisual: true,
    beforeParse(w){
      Object.defineProperty(w, "localStorage", { value: {
        getItem: k => (k in almacen ? almacen[k] : null),
        setItem: (k, v) => { almacen[k] = String(v); },
        removeItem: k => { delete almacen[k]; }
      }});
      Object.defineProperty(w.navigator, "onLine", { value: conexion, configurable: true });
      if (fecha) w.Date = class extends Date {
        constructor(...a){ super(...(a.length ? a : [fecha])); }
        static now(){ return new Date(fecha).getTime(); }
      };
      if (posicion) w.navigator.geolocation = { getCurrentPosition: ok =>
        setTimeout(() => ok({ coords:{ latitude:posicion[0], longitude:posicion[1] } }), 10) };
      if (respuestaFetch) w.fetch = async () => ({ ok:true, json: async () => respuestaFetch });
      w.supabase = { createClient: () => ({
        auth: { getSession: async () => ({ data:{ session: sesion } }),
                signInWithPassword: async () => ({ data:{}, error:{ message:"Invalid login credentials" } }),
                signOut: async () => {} },
        from: () => ({
          select: Object.assign(async () => ({ data:[], error:null }),
            { eq: () => ({ maybeSingle: async () => ({ data:null, error:null }) }) }),
          upsert: async () => ({ error:null }),
          update: () => ({ eq: async () => ({ error:null }) })
        })
      })};
      w.alert = () => {}; w.confirm = () => true; w.prompt = () => null;
      w.addEventListener("error", e => errores.push(e.error ? e.error.message : "?"));
    }
  });
  dom.errores = errores;
  return dom;
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

/* ═══ 1. Cada app carga y pinta ═══ */
async function appCargaYPinta(nombre, ruta, url, extra = {}){
  console.log(`\n${gris("──")} ${nombre}`);
  const dom = abrir(ruta, { url, ...extra });
  await esperar(700);
  const d = dom.window.document;

  comprobar("carga sin errores de JavaScript", dom.errores.length === 0, dom.errores[0]);

  const botones = [...d.querySelectorAll("nav button")];
  if (botones.length){
    for (const b of botones){
      b.click();
      await esperar(30);
      const v = d.getElementById("v-" + b.dataset.v);
      comprobar(`la pestaña «${b.textContent.trim()}» tiene contenido`,
                v && v.innerHTML.trim().length > 40,
                v ? `${v.innerHTML.trim().length} caracteres` : "no existe");
    }
  } else {
    comprobar("la página tiene contenido", d.body.innerHTML.trim().length > 200);
  }

  // Los enlaces deben ser de un esquema conocido
  // esquemas conocidos, rutas relativas y anclas
  const permitidos = /^(https?:|waze:|p4n:|wikiloc:|tel:|mailto:|data:|#|\/|\.{1,2}\/|[\w.-]+\/)/;
  const raros = [...d.querySelectorAll("a[href]")]
    .map(a => a.getAttribute("href"))
    .filter(h => h && !permitidos.test(h));
  comprobar("no hay enlaces con esquema desconocido", raros.length === 0, raros[0]);

  return dom;
}

/* ═══ 2. El editor guarda, importa y exporta ═══ */
async function editorFunciona(){
  console.log(`\n${gris("──")} Editor: guardar, importar, exportar`);
  const almacen = {};
  const dom = abrir("crear/index.html", { url:"https://x/crear/", almacen, conexion:false });
  await esperar(500);
  const d = dom.window.document, w = dom.window;
  const escribir = (id, v) => { const e = d.getElementById(id); e.value = v;
    e.dispatchEvent(new w.Event("input", { bubbles:true })); };

  escribir("nombre", "Viaje de prueba");
  comprobar("el título sigue al nombre",
            d.getElementById("titulo").textContent === "Viaje de prueba");

  d.getElementById("add-dia").click();
  await esperar(50);
  comprobar("se puede añadir un día", d.querySelectorAll(".dia").length >= 1);

  d.getElementById("guardar").click();
  await esperar(200);
  const guardado = almacen.viajes_propios ? JSON.parse(almacen.viajes_propios) : [];
  comprobar("el viaje se guarda en el móvil", guardado.length === 1 && guardado[0].nombre === "Viaje de prueba");

  // Importar Markdown
  const md = `# Croacia\nSalida: León\n\n## Día 1 — Zagreb\nDuermes en: Zagreb\nCoche: 40 km · 45 min\n\n- **Tarde** · ★ Plaza Ban Jelačić — El centro. [Trg bana Jelacica]\n- Si llueve: Museo de las Relaciones Rotas.`;
  const leido = w.leerMarkdown ? w.leerMarkdown(md) : null;
  if (leido){
    comprobar("lee un itinerario en Markdown", leido.dias.length === 1);
    comprobar("recoge los kilómetros del día", leido.dias[0].km === "40 km · 45 min");
    comprobar("recoge el imprescindible", leido.dias[0].paradas[0].key === true);
    comprobar("recoge el plan B de lluvia", !!leido.dias[0].lluvia);
    comprobar("recoge el destino del GPS", leido.dias[0].paradas[0].mapa === "Trg bana Jelacica");
  } else {
    comprobar("lee un itinerario en Markdown", false, "leerMarkdown no es accesible");
  }

  // Exportar y volver a leer: el círculo debe cerrar
  if (w.aMarkdown && w.leerMarkdown){
    const v = { nombre:"Ida y vuelta", salida:"León", dias:[
      { t:"Día uno", dest:"Zagreb", km:"40 km", lluvia:"Museo",
        paradas:[{ h:"Tarde", txt:"Plaza", n:"El centro", mapa:"Trg bana", key:true }] }] };
    const vuelta = w.leerMarkdown(w.aMarkdown(v));
    comprobar("lo que exporta lo vuelve a leer igual",
      vuelta && vuelta.nombre === v.nombre && vuelta.dias[0].paradas[0].txt === "Plaza"
      && vuelta.dias[0].km === "40 km" && vuelta.dias[0].paradas[0].key === true);
  }
  comprobar("el editor no dio errores", dom.errores.length === 0, dom.errores[0]);
}

/* ═══ 3. La nube no bloquea nunca ═══ */
async function nubeAguanta(){
  console.log(`\n${gris("──")} Sincronización: sin sesión y sin conexión`);
  for (const [caso, opciones] of [
    ["sin sesión",   { sesion:null, conexion:true }],
    ["sin conexión", { sesion:null, conexion:false }]
  ]){
    const almacen = { viajes_propios: JSON.stringify([
      { id:"x", nombre:"Local", desde:"", hasta:"", salida:"", dias:[] }]) };
    const dom = abrir("index.html", { almacen, ...opciones });
    await esperar(1400);
    const d = dom.window.document;
    const estado = d.getElementById("nube")?.textContent || "";
    comprobar(`${caso}: la portada resuelve el estado`,
              estado.length > 0 && !estado.startsWith("comprobando"), estado);
    comprobar(`${caso}: la lista sigue usable`, d.querySelectorAll(".viaje").length >= 3);
  }
}

/* ═══ 4. El estado sobrevive a los repintados ═══ */
async function estadoSobrevive(){
  console.log(`\n${gris("──")} La portada no se queda en «comprobando…»`);
  const almacen = {};
  const dom = abrir("index.html", { almacen, sesion:{ user:{ email:"d@x.com" } } });
  await esperar(1400);
  const d = dom.window.document;

  // un estado válido tiene texto y no es «comprobando…»
  const valido = t => t.trim().length > 3 && !t.trim().startsWith("comprobando");

  const inicial = d.getElementById("nube")?.textContent || "";
  comprobar("resuelve al arrancar", valido(inicial), `«${inicial}»`);

  // cambiar de tema repinta el pie: el estado no debe perderse
  d.querySelector('[data-tema="claro"]')?.click();
  await esperar(250);
  const tras = d.getElementById("nube")?.textContent || "";
  comprobar("sobrevive al cambiar de tema", valido(tras), `«${tras}»`);
  comprobar("el botón de actualizar sigue ahí", !!d.getElementById("btn-actualizar"));

  d.querySelector('[data-tema="oscuro"]')?.click();
  await esperar(250);
  const tras2 = d.getElementById("nube")?.textContent || "";
  comprobar("y al volver a cambiarlo", valido(tras2), `«${tras2}»`);
}

/* ═══ Ejecutar ═══ */
(async () => {
  console.log("\n" + gris("═".repeat(52)));
  console.log("  Pruebas de las apps de viajes");
  console.log(gris("═".repeat(52)));

  const conViaje = JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"", salida:"León",
    dias:[{ t:"Día uno", dest:"Zagreb", km:"40 km",
            paradas:[{ h:"Tarde", txt:"Una parada", n:"Una nota", mapa:"Zagreb" }] }],
    reservas:{ vuelos:[{ruta:"MAD → ZAG",fecha:"1 sep",hora:"18:55",cia:"X",loc:"ABC123",n:""}],
               coche:{empresa:"Rent",reserva:"R1",recogida:"",devolucion:"",telefono:"+34600000000"},
               telefonos:[{q:"Hotel",n:"+34611111111"}] } }]);

  await appCargaYPinta("Portada",   "index.html", "https://x/");
  await appCargaYPinta("Eslovenia", "eslovenia/index.html", "https://x/eslovenia/",
                       { fecha:"2026-07-25T12:00:00" });
  await appCargaYPinta("Asturias",  "asturias/index.html", "https://x/asturias/");
  await appCargaYPinta("Visor",     "viaje/index.html", "https://x/viaje/?id=p1",
                       { almacen:{ viajes_propios: conViaje } });
  await appCargaYPinta("Editor",    "crear/index.html", "https://x/crear/");

  await editorFunciona();
  await nubeAguanta();
  await estadoSobrevive();

  console.log("\n" + gris("─".repeat(52)));
  if (fallos === 0) console.log(`  ${verde("Todo correcto")} · ${pruebas} comprobaciones\n`);
  else console.log(`  ${rojo(fallos + " fallo(s)")} de ${pruebas} comprobaciones\n`);
  process.exit(fallos ? 1 : 0);
})();
