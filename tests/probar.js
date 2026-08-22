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
const { JSDOM, VirtualConsole } = require("jsdom");

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

/* ---- Mete en línea los scripts propios, como haría el navegador ----
   jsdom no baja scripts por red, así que hay que darle el contenido. Al
   hacerlo por la etiqueta y no por una lista escrita a mano, un archivo
   nuevo del que dependa una app (datos.js) entra solo en las pruebas. */
function conScriptsDentro(html, rutaHtml){
  const carpeta = path.posix.dirname(rutaHtml.split(path.sep).join("/"));
  return html.replace(/<script\s+src="([^"]+)"><\/script>/g, (etiqueta, src) => {
    if (/^https?:/.test(src)) return etiqueta;
    const real = path.join(RAIZ, path.posix.normalize(path.posix.join(carpeta, src)));
    if (!fs.existsSync(real)) return etiqueta;
    return `<script>\n${fs.readFileSync(real, "utf8")}\n</script>`;
  });
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

  const html = conScriptsDentro(fs.readFileSync(path.join(RAIZ, rutaHtml), "utf8"), rutaHtml);

  const errores = [];
  // jsdom no es un navegador: avisa de lo que no implementa (navegar,
  // hacer scroll). Eso no son fallos de la app, y su ruido tapa los que
  // sí lo son. Se filtran solo esos avisos; los errores de JavaScript de
  // verdad siguen recogiéndose abajo, en el listener de "error".
  const consola = new VirtualConsole();
  consola.on("jsdomError", e => {
    if (/Not implemented/.test(e && e.message)) return;
    console.error(e && e.message);
  });
  ["log","info","warn","error"].forEach(n => consola.on(n, (...a) => console[n](...a)));

  const dom = new JSDOM(html, {
    runScripts: "dangerously", url, pretendToBeVisual: true, virtualConsole: consola,
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
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = () => {};
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

/* ═══ 5. Toda función usada existe ═══ */
function funcionesDefinidas(){
  console.log(`\n${gris("──")} No se usa ninguna función sin definir`);
  const archivos = ["index.html","crear/index.html","viaje/index.html",
                    "eslovenia/index.html","asturias/index.html"];
  // funciones propias del proyecto que se llaman en plantillas
  const vigiladas = ["navegar","navegarXY","mapsDe","mapsXY","wazeXY","waze","wikiloc",
                     "tiempoEn","distancia","distKm","ubicacion","pedirUbicacion",
                     "esc","mapa","xyDeParada","buscarServicios","lanzarServicios"];
  for (const a of archivos){
    // el motor común cuenta como parte de cada app: lo cargan todas
    const motor = fs.existsSync(path.join(RAIZ, "assets/app.js"))
      ? fs.readFileSync(path.join(RAIZ, "assets/app.js"), "utf8") : "";
    const propio = fs.readFileSync(path.join(RAIZ, a), "utf8");
    const src = propio.includes("assets/app.js") ? propio + "\n" + motor : propio;
    // no cuentan los usos protegidos: typeof x === "function" ? x() : otra()
    const limpio = src.replace(/typeof\s+(\w+)\s*===\s*"function"\s*\?[^:]*:/g, "");
    const usadas = vigiladas.filter(f => new RegExp("[^\\w.]" + f + "\\s*\\(").test(limpio));
    const sinDefinir = usadas.filter(f =>
      !new RegExp("(const|let|var|function)\\s+" + f + "\\b").test(src));
    comprobar(`${a}: todas definidas`, sinDefinir.length === 0,
              sinDefinir.length ? "falta: " + sinDefinir.join(", ") : "");
  }
}

/* ═══ 6. El tema claro llega a todas partes ═══ */
function temaClaroCompleto(){
  console.log(`\n${gris("──")} Nada se queda oscuro en modo claro`);
  const archivos = ["index.html","crear/index.html","viaje/index.html",
                    "eslovenia/index.html","asturias/index.html"];
  // Lo estructural: si esto no sigue al tema, la app se ve mal con sol
  const estructura = ["body", "nav", "header", ".barra", ".card", "main"];

  for (const a of archivos){
    const src = fs.readFileSync(path.join(RAIZ, a), "utf8");
    const css = (src.match(/<style>([\s\S]*?)<\/style>/) || ["",""])[1];

    const culpables = [];
    for (const sel of estructura){
      // regla que empieza al principio de una línea (aunque haya comentarios antes)
      const re = new RegExp("^\\s*" + sel.replace(".","\\.") +
                            "\\s*\\{([^}]*)\\}", "gm");
      let m;
      while ((m = re.exec(css))){
        const cuerpo = m[1];
        const fondo = /background(?:-color)?:\s*([^;]+)/.exec(cuerpo);
        if (!fondo) continue;
        const v = fondo[1].trim();
        // vale si usa variable, color-mix, transparente o degradado con variable
        if (/var\(|color-mix|transparent|inherit|none/.test(v)) continue;
        culpables.push(`${sel} → ${v.slice(0,30)}`);
      }
    }
    comprobar(`${a}: barra, cabecera y tarjetas siguen el tema`,
              culpables.length === 0, culpables[0]);
    comprobar(`${a}: define el modo claro`, /body\.claro\s*\{/.test(css));
  }
}

/* ═══ 7. Sin identificadores repetidos entre vistas ═══ */
function idsUnicos(){
  console.log(`\n${gris("──")} Cada vista tiene sus propios identificadores`);
  const archivos = ["viaje/index.html","eslovenia/index.html","asturias/index.html"];
  for (const a of archivos){
    const src = fs.readFileSync(path.join(RAIZ, a), "utf8");
    // ids que se generan dentro de plantillas: deben llevar el contexto
    // solo los bloques que se dibujan dos veces: en Hoy y en el detalle del día
    const porDia = ["fotos", "gal", "aqui", "lista-aqui"];
    const sospechosos = [];
    for (const m of src.matchAll(/id="([a-z-]+)-\$\{(?:ctx|i)[^}]*\}[^"]*"/g)){
      const base = m[1];
      if (porDia.includes(base) && !m[0].includes("${ctx}")) sospechosos.push(base);
    }
    comprobar(`${a}: los ids de día llevan contexto`, sospechosos.length === 0,
              sospechosos.length ? "sin ctx: " + [...new Set(sospechosos)].join(", ") : "");

    // los huecos fijos no pueden estar duplicados
    for (const fijo of ["portada-hoy","portada-det"]){
      const n = (src.match(new RegExp(`id="${fijo}"`, "g")) || []).length;
      comprobar(`${a}: «${fijo}» aparece una vez`, n === 1, `${n} veces`);
    }
  }
}

/* ═══ 8. La posición se admite en sus dos formas ═══ */
function posicionEnDosFormas(){
  console.log(`\n${gris("──")} La ubicación vale como texto y como lista`);
  const M = fs.readFileSync(path.join(RAIZ, "assets/app.js"), "utf8");
  const trozo = sel => (M.match(sel) || [""])[0];

  const casos = [
    ["lista [lat, lon]",  [46.36, 14.11], undefined, 4],
    ["texto «lat,lon»",   undefined, "46.36,14.11", 4],
    ["sin ubicación",     null, null, 3],
    ["valores no válidos", ["x","y"], null, 3]
  ];
  for (const [nombre, MIPOS, miPos, esperados] of casos){
    const distancia = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]) * 111;
    const VIAJE = { dias:[{ xy:"46.281,14.322", paradas:[
      { xy:"46.368,14.095" }, { g:"vintgar" }, { txt:"sin coords" } ]}]};
    const LUGARES = { vintgar:{ xy:"46.393,14.058" } };
    let n = -1, fallo = "";
    try {
      const fn = new Function("VIAJE","LUGARES","MIPOS","miPos","distancia",
        trozo(/function comoTexto[\s\S]*?\n\}/) + "\n" +
        trozo(/function comoPar[\s\S]*?\n\}/) + "\n" +
        trozo(/function xyDeParada[\s\S]*?\n\}/) + "\n" +
        trozo(/function puntosDeRuta[\s\S]*?\n\}/) + "\nreturn puntosDeRuta;");
      n = fn(VIAJE, LUGARES, MIPOS, miPos, distancia)(0).length;
    } catch (e){ fallo = e.message; }
    comprobar(`${nombre}: ${esperados} puntos`, n === esperados, fallo || `salieron ${n}`);
  }
}

/* ---- 9. Nada se pierde al sincronizar ----
   El móvil manda: lo que la nube no sepa llevar no puede borrarlo. */
function montarNube(opciones = {}){
  const { columnasViejas = false } = opciones;
  const codigo = fs.readFileSync(path.join(RAIZ, "sync.js"), "utf8");

  const almacen = {};
  const localStorage = {
    getItem: k => (k in almacen ? almacen[k] : null),
    setItem: (k, v) => { almacen[k] = String(v); },
    removeItem: k => { delete almacen[k]; }
  };

  // Un servidor que solo acepta las columnas que existen de verdad
  const COLUMNAS = ["id","nombre","desde","hasta","salida","dias","autor","actualizado","borrado"];
  if (!columnasViejas) COLUMNAS.push("extra");
  const TABLA = new Map();
  const cliente = { from(){ return {
    async upsert(fila){
      const sobran = Object.keys(fila).filter(k => !COLUMNAS.includes(k));
      if (sobran.length) return { error:{ message:`no existe la columna «${sobran[0]}»` } };
      TABLA.set(fila.id, { ...fila });
      return { error:null };
    },
    async select(){ return { data:[...TABLA.values()], error:null }; },
    update(){ return { eq: async () => ({ error:null }) }; }
  }; } };

  const ctx = {
    localStorage,
    window: { addEventListener(){}, supabase:null },
    document: { head:{ appendChild(){} }, createElement:() => ({}) },
    navigator: { onLine:true },
    setTimeout, clearTimeout, console,
    Promise, JSON, Date, Set, Map, Object, Array, String, Number, Math,
    fetch: async () => ({ ok:false })
  };
  const fn = new Function(...Object.keys(ctx), codigo + "\nreturn { SYNC };");
  const { SYNC } = fn(...Object.values(ctx));
  SYNC.conectar = async () => cliente;      // sin red: se prueba la fusión, no Supabase
  SYNC.sesion = { user:{ email:"prueba@ejemplo" } };
  return { SYNC, TABLA };
}

function viajeDePrueba(){
  return {
    id:"p9", nombre:"Prueba", desde:"2026-07-18", hasta:"2026-07-20", salida:"León",
    normas:["Andando sin acera se camina por la izquierda"],
    dias:[{ t:"Día uno", dest:"Zagreb", paradas:[{ h:"10:00", txt:"Llegada" }] }],
    reservas:{ vuelos:[{ ruta:"MAD → ZAG", loc:"ABC123" }], coche:{ reserva:"R1" }, telefonos:[] },
    actualizado:"2026-01-01T10:00:00.000Z"
  };
}

async function nadaSePierdeEnLaNube(){
  console.log("\n" + gris("──") + " Nada se pierde al sincronizar");

  // Guardar, subir y volver a bajar no puede vaciar el viaje
  {
    const { SYNC } = montarNube();
    const v = viajeDePrueba();
    SYNC.guardarLocales([v]);
    await SYNC.subir(v);
    await SYNC.sincronizar();
    const d = SYNC.locales()[0] || {};
    comprobar("las reservas siguen ahí",
      d.reservas?.vuelos?.[0]?.loc === "ABC123", "el viaje volvió sin reservas");
    comprobar("las normas siguen ahí",
      Array.isArray(d.normas) && d.normas.length === 1, "el viaje volvió sin normas");
  }

  // Un bloque que el modelo todavía no conoce tampoco puede perderse
  {
    const { SYNC } = montarNube();
    const v = viajeDePrueba();
    v.guia = [{ zona:"Somiedo", lugares:[{ id:"teitos", n:"Cabañas de teito" }] }];
    v.inventadoElAnioQueViene = { algo:"que hoy no existe" };
    SYNC.guardarLocales([v]);
    await SYNC.subir(v);
    await SYNC.sincronizar();
    const d = SYNC.locales()[0] || {};
    comprobar("la guía sigue ahí",
      d.guia?.[0]?.lugares?.[0]?.id === "teitos", "el viaje volvió sin guía");
    comprobar("un campo futuro desconocido sigue ahí",
      d.inventadoElAnioQueViene?.algo === "que hoy no existe", "se descartó lo que no se reconoce");
  }

  // Con una base de datos antigua, sin la columna nueva, tampoco se pierde nada
  {
    const { SYNC } = montarNube({ columnasViejas:true });
    const v = viajeDePrueba();
    SYNC.guardarLocales([v]);
    const subido = await SYNC.subir(v);
    await SYNC.sincronizar();
    const d = SYNC.locales()[0] || {};
    comprobar("con la base de datos antigua, el viaje se sube igual",
      subido === true, "se quedó pendiente de subir");
    comprobar("con la base de datos antigua, las reservas siguen ahí",
      d.reservas?.vuelos?.[0]?.loc === "ABC123", "el viaje volvió sin reservas");
  }

  // Y lo que la nube sí sabe llevar sigue mandando si es más reciente
  {
    const { SYNC, TABLA } = montarNube();
    const v = viajeDePrueba();
    SYNC.guardarLocales([v]);
    await SYNC.subir(v);
    const fila = TABLA.get("p9");
    fila.nombre = "Cambiado en el otro móvil";
    fila.actualizado = "2027-01-01T10:00:00.000Z";
    await SYNC.sincronizar();
    const d = SYNC.locales()[0] || {};
    comprobar("gana el más reciente en lo que la nube sí lleva",
      d.nombre === "Cambiado en el otro móvil", `quedó «${d.nombre}»`);
    comprobar("y aun así no se lleva por delante las reservas",
      d.reservas?.vuelos?.[0]?.loc === "ABC123", "el viaje volvió sin reservas");
  }
}

/* ---- 10. Lo que la app carga, su service worker lo guarda ----
   El fallo más repetido del repositorio: se añade un archivo, se olvida
   decirlo en el sw.js, y desde el icono de inicio la app se queda a
   medias porque sin cobertura ese archivo no está. */
const APPS_CON_SW = [
  { carpeta: ".",         nombre: "portada"   },
  { carpeta: "crear",     nombre: "editor"    },
  { carpeta: "viaje",     nombre: "visor"     },
  { carpeta: "eslovenia", nombre: "Eslovenia" },
  { carpeta: "asturias",  nombre: "Asturias"  }
];

/* Deja una ruta en su forma canónica desde la raíz del repositorio */
function desdeLaRaiz(carpeta, ruta){
  const base = carpeta === "." ? "" : carpeta;
  return path.posix.normalize(path.posix.join(base, ruta)).replace(/^\.\//, "");
}

function scriptsDe(html){
  return [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
}

function archivosDelSw(codigo){
  const m = codigo.match(/const ARCHIVOS\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) return null;
  try { return new Function("return " + m[1])(); } catch { return null; }
}

function dependenciasEnServiceWorker(){
  console.log("\n" + gris("──") + " Lo que la app carga, su service worker lo guarda");

  for (const app of APPS_CON_SW){
    const rutaHtml = path.posix.join(app.carpeta === "." ? "." : app.carpeta, "index.html");
    const rutaSw   = path.posix.join(app.carpeta === "." ? "." : app.carpeta, "sw.js");
    const html = fs.readFileSync(path.join(RAIZ, rutaHtml), "utf8");
    const sw   = fs.readFileSync(path.join(RAIZ, rutaSw), "utf8");

    const archivos = archivosDelSw(sw);
    if (!archivos){
      comprobar(`${app.nombre}: su sw.js declara qué guardar`, false, "no se pudo leer ARCHIVOS");
      continue;
    }
    const guardados = new Set(archivos.map(a => desdeLaRaiz(app.carpeta, a)));

    for (const src of scriptsDe(html)){
      if (/^https?:/.test(src)) continue;          // lo de fuera no se guarda
      const quiere = desdeLaRaiz(app.carpeta, src);
      comprobar(`${app.nombre}: ${src} está en su sw.js`,
                guardados.has(quiere),
                `ARCHIVOS no incluye «${quiere}»`);
    }

    // Y el archivo debe existir de verdad, no ser una ruta muerta
    for (const a of archivos){
      if (a === "./" || /^https?:/.test(a)) continue;
      const real = path.join(RAIZ, desdeLaRaiz(app.carpeta, a));
      comprobar(`${app.nombre}: ${a} existe`, fs.existsSync(real), "el sw.js guarda un archivo que no está");
    }
  }
}

/* ---- 11. El editor no pierde lo que todavía no sabe editar ----
   Abrir un viaje y guardarlo sin tocar nada tiene que devolverlo entero,
   aunque traiga bloques que el editor no enseña en ningún formulario. */
function viajeConTodo(){
  return {
    id:"asturias", nombre:"Asturias occidental", desde:"2026-08-05", hasta:"2026-08-09",
    salida:"San Miguel de las Dueñas",
    actualizado:"2026-01-01T10:00:00.000Z",
    dias:[{
      d:1, t:"Subida a Somiedo", dest:"Pola de Somiedo", km:"150 km · 2 h 30",
      xy:"43.090,-6.250", arte:"puerto", base:"Zona alta de Somiedo",
      paradas:[{ h:"Mañana", txt:"Puerto de Somiedo", c:"Pola de Somiedo",
                 n:"Carretera de puerto", mapa:"Pola de Somiedo", key:true,
                 g:"centro", w:"Somiedo", wl:"lagos de saliencia", xy:"43.090,-6.250",
                 park:{ n:"La Farrapona", w:"Farrapona aparcamiento", p:"Se llena antes de las 9", gratis:true } }]
    }],
    guia:[{ zona:"Somiedo", arte:"lagos", nota:"Parque natural",
            lugares:[{ id:"teitos", xy:"43.058,-6.094", n:"Cabañas de teito", t:"Techo de escoba" }] }],
    vuelos:[{ ruta:"MAD → OVD", loc:"ABC123", asientos:[["Dani","22D"]] }],
    coche:{ proveedor:"Last Minute Rent", franquicia:"1.200 €" },
    seguros:[{ nombre:"Sanitas", poliza:"P1" }],
    telefonos:[{ q:"Emergencias", n:"112", urgente:true }],
    alojamientos:[{ fechas:"5–6 ago", nombre:"Camping Lagos", zona:"Somiedo" }],
    info:[{ id:"furgo", titulo:"En la furgo", filas:[["Agua","Fuentes en los pueblos"]] }],
    normas:["Se conduce por la derecha"]
  };
}

/* Recorre dos objetos y devuelve la primera ruta que se ha perdido */
function loQueFalta(antes, despues, ruta = ""){
  if (antes === null || typeof antes !== "object"){
    return JSON.stringify(antes) === JSON.stringify(despues) ? null : (ruta || "(raíz)");
  }
  if (Array.isArray(antes)){
    if (!Array.isArray(despues) || despues.length !== antes.length) return ruta + "[]";
    for (let i = 0; i < antes.length; i++){
      const f = loQueFalta(antes[i], despues[i], `${ruta}[${i}]`);
      if (f) return f;
    }
    return null;
  }
  if (despues === null || typeof despues !== "object") return ruta || "(raíz)";
  for (const k of Object.keys(antes)){
    const f = loQueFalta(antes[k], despues[k], ruta ? `${ruta}.${k}` : k);
    if (f) return f;
  }
  return null;
}

async function editorConservaTodo(){
  console.log(`\n${gris("──")} El editor no pierde lo que no sabe editar`);

  // Abrir un viaje con todos los bloques y guardarlo sin tocar nada
  {
    const original = viajeConTodo();
    const almacen = { viajes_propios: JSON.stringify([original]) };
    const dom = abrir("crear/index.html", { url:"https://x/crear/?id=asturias", almacen, conexion:false });
    await esperar(400);
    const d = dom.window.document;

    d.getElementById("guardar").click();
    await esperar(200);

    const guardado = (JSON.parse(almacen.viajes_propios || "[]"))[0] || {};
    const perdido = loQueFalta({ ...original, actualizado: guardado.actualizado }, guardado);
    comprobar("abrir y guardar sin tocar nada conserva el viaje entero",
              perdido === null, `se perdió «${perdido}»`);
    comprobar("el editor no dio errores al abrirlo", dom.errores.length === 0, dom.errores[0]);
  }

  // Importar tampoco puede tirar lo que no reconoce
  {
    const dom = abrir("crear/index.html", { url:"https://x/crear/", almacen:{}, conexion:false });
    await esperar(400);
    const w = dom.window;
    if (!w.normalizar){
      comprobar("importar conserva los bloques propios", false, "normalizar no es accesible");
    } else {
      const v = w.normalizar(viajeConTodo());
      comprobar("importar conserva la guía de lugares",
                v.guia?.[0]?.lugares?.[0]?.id === "teitos", "la guía se descartó");
      comprobar("importar conserva los datos propios de la parada",
                v.dias[0].paradas[0].g === "centro" && v.dias[0].paradas[0].park?.gratis === true
                && v.dias[0].paradas[0].xy === "43.090,-6.250", "se descartaron g/park/xy");
      comprobar("importar conserva lo propio del día",
                v.dias[0].arte === "puerto" && v.dias[0].base === "Zona alta de Somiedo",
                "se descartaron arte/base");
      comprobar("importar conserva vuelos, coche y seguros",
                !!v.vuelos && !!v.coche && !!v.seguros, "se descartaron los bloques de reserva");
      comprobar("importar sigue dando un id nuevo",
                typeof v.id === "string" && v.id !== "asturias", `quedó «${v.id}»`);
      comprobar("importar sigue normalizando lo que sí conoce",
                v.dias[0].paradas[0].txt === "Puerto de Somiedo" && v.nombre === "Asturias occidental");
    }
  }
}

/* ---- 12. Los viajes escritos a mano se pueden editar ----
   Eslovenia y Asturias traen sus datos en datos.js. Al editarlos, manda
   la copia guardada en el móvil; si no hay copia, manda el archivo.
   Se mira lo que se pinta, no las variables: `const` en un script normal
   no se cuelga de window, y compararlas daría verde siempre. */
function datosOriginales(carpeta){
  const codigo = fs.readFileSync(path.join(RAIZ, carpeta, "datos.js"), "utf8");
  return new Function(codigo + "\nreturn VIAJE_ORIGINAL;")();
}

const A_MEDIDA = [
  { nombre:"Asturias",  carpeta:"asturias",  url:"https://x/asturias/",  opciones:{} },
  { nombre:"Eslovenia", carpeta:"eslovenia", url:"https://x/eslovenia/",
    opciones:{ fecha:"2026-07-25T12:00:00" } }
];

/* Abre la app, va a Info y devuelve el nombre que enseña la cabecera */
async function nombreQuePinta(app, almacen){
  const dom = abrir(`${app.carpeta}/index.html`, { url:app.url, almacen, conexion:false, ...app.opciones });
  await esperar(400);
  const d = dom.window.document;
  [...d.querySelectorAll("nav button")].find(b => b.dataset.v === "info")?.click();
  await esperar(150);
  return { dom, d, nombre: d.getElementById("eyebrow")?.textContent || "" };
}

async function viajesAMedidaEditables(){
  console.log(`\n${gris("──")} Eslovenia y Asturias se pueden editar`);

  for (const app of A_MEDIDA){
    const original = datosOriginales(app.carpeta);
    comprobar(`${app.nombre}: datos.js se sostiene solo`,
              !!original && Array.isArray(original.dias) && original.dias.length > 0,
              "no define un viaje con días");

    // Sin copia guardada manda el archivo, y la pestaña Info ofrece editar
    {
      const almacen = {};
      const { dom, d, nombre } = await nombreQuePinta(app, almacen);
      comprobar(`${app.nombre}: sin copia guardada pinta el viaje del archivo`,
                nombre === original.nombre, `pintó «${nombre}»`);

      const boton = d.getElementById("btn-editar");
      comprobar(`${app.nombre}: la pestaña Info ofrece editar el viaje`, !!boton, "no está el botón");

      if (boton){
        boton.click();
        await esperar(150);
        const copia = (JSON.parse(almacen.viajes_propios || "[]")).find(v => v.id === app.carpeta);
        comprobar(`${app.nombre}: al editar, el viaje pasa al móvil con su id de siempre`,
                  !!copia, "no se guardó, o se guardó con otro id");
        if (copia){
          const perdido = loQueFalta({ ...original, id:app.carpeta, actualizado:copia.actualizado }, copia);
          comprobar(`${app.nombre}: la copia lleva el viaje entero`, perdido === null, `se perdió «${perdido}»`);
          comprobar(`${app.nombre}: la copia lleva la guía de lugares`,
                    Array.isArray(copia.guia) && copia.guia.length > 0, "la guía no viajó");
        }
      }
      comprobar(`${app.nombre}: sin errores al ofrecer la edición`, dom.errores.length === 0, dom.errores[0]);
    }

    // Con copia guardada manda la copia
    {
      const editado = { id:app.carpeta, nombre:"Cambiado a mano", desde:"2026-07-18", hasta:"", salida:"",
                        dias:[{ t:"Un solo día", dest:"Donde sea", paradas:[{ h:"10:00", txt:"Parada única" }] }],
                        actualizado:"2030-01-01T00:00:00.000Z" };
      const { dom, nombre } = await nombreQuePinta(app, { viajes_propios: JSON.stringify([editado]) });
      comprobar(`${app.nombre}: con copia guardada, manda la copia`,
                nombre === "Cambiado a mano", `pintó «${nombre}»`);
      comprobar(`${app.nombre}: editado, sigue pintando sin errores`, dom.errores.length === 0, dom.errores[0]);
    }

    // Una copia a medio guardar no puede dejar la app sin itinerario
    {
      const roto = JSON.stringify([{ id:app.carpeta, nombre:"A medio guardar", dias:[] }]);
      const { nombre } = await nombreQuePinta(app, { viajes_propios: roto });
      comprobar(`${app.nombre}: una copia sin días no deja la app sin viaje`,
                nombre === original.nombre, `pintó «${nombre}»`);
    }
  }
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
  funcionesDefinidas();
  temaClaroCompleto();
  idsUnicos();
  posicionEnDosFormas();
  await nadaSePierdeEnLaNube();
  dependenciasEnServiceWorker();
  await editorConservaTodo();
  await viajesAMedidaEditables();
  await viajesAMedidaEditables();

  console.log("\n" + gris("─".repeat(52)));
  if (fallos === 0) console.log(`  ${verde("Todo correcto")} · ${pruebas} comprobaciones\n`);
  else console.log(`  ${rojo(fallos + " fallo(s)")} de ${pruebas} comprobaciones\n`);
  process.exit(fallos ? 1 : 0);
})();
