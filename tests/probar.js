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
    respuestaFetch = null,
    fetchPropio = null,          // para simular una petición que no responde
    swPropio = null              // para simular un service worker que se cuelga
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
      if (fetchPropio) w.fetch = fetchPropio;
      if (swPropio) Object.defineProperty(w.navigator, "serviceWorker", { value: swPropio, configurable: true });
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
/* Ningún identificador puede aparecer dos veces en la página pintada: el
   segundo queda muerto, porque getElementById devuelve siempre el primero.
   Así había un <div id="vistazo"> de más en Asturias.

   Se mira el DOM ya pintado, no el código fuente: en el fuente hay ids que
   salen dos veces a propósito, en ramas excluyentes («si no hay ubicación,
   pinta esto; si la hay, esto otro»), y contarlos daría un falso positivo. */
async function idsSinRepetir(){
  console.log(`\n${gris("──")} Ningún identificador se repite en la página`);

  const apps = [
    { nombre:"portada",   ruta:"index.html",           url:"https://x/" },
    { nombre:"editor",    ruta:"crear/index.html",     url:"https://x/crear/" },
    { nombre:"visor",     ruta:"viaje/index.html",     url:"https://x/viaje/?id=p1",
      opciones:{ almacen:{ viajes_propios: JSON.stringify([{ id:"p1", nombre:"Prueba",
        desde:"", hasta:"", salida:"", dias:[{ t:"Día uno", dest:"Zagreb",
        paradas:[{ h:"Tarde", txt:"Una parada" }] }] }]) } } },
    { nombre:"Eslovenia", ruta:"eslovenia/index.html", url:"https://x/eslovenia/",
      opciones:{ fecha:"2026-07-25T12:00:00" } },
    { nombre:"Asturias",  ruta:"asturias/index.html",  url:"https://x/asturias/" }
  ];

  // Los ids de dentro de un SVG se quedan fuera: los gradientes repiten el
  // suyo en cada ilustración y `url(#g)` resuelve al primero, que es idéntico
  // al resto. Es marcado inválido, sí, pero no rompe nada y arreglarlo mueve
  // las fotografías sin que nadie note la diferencia. Anotado en PENDIENTE.
  const repetidos = d => {
    const visto = new Set(), repes = new Set();
    for (const el of d.querySelectorAll("[id]")){
      if (el.closest("svg")) continue;
      if (visto.has(el.id)) repes.add(el.id); else visto.add(el.id);
    }
    return [...repes];
  };

  for (const app of apps){
    const dom = abrir(app.ruta, { url:app.url, conexion:false, almacen:{}, ...(app.opciones || {}) });
    await esperar(400);
    const d = dom.window.document;
    const botones = [...d.querySelectorAll("nav button")];
    let malas = [];

    if (!botones.length){
      malas = repetidos(d).map(x => `(página) ${x}`);
    } else {
      for (const b of botones){
        b.click();
        await esperar(120);
        malas = malas.concat(repetidos(d).map(x => `${b.dataset.v}: ${x}`));
      }
    }
    comprobar(`${app.nombre}: ningún id repetido en ninguna pestaña`,
              malas.length === 0, [...new Set(malas)].join(" · "));
  }
}

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
  // Se puede quitar la cobertura o tirar el servidor a mitad de la prueba
  const red = { conectada:true, falla:null, fallaBorrado:null };
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
      if (red.falla) return { error:red.falla };
      const sobran = Object.keys(fila).filter(k => !COLUMNAS.includes(k));
      if (sobran.length) return { error:{
        code:"PGRST204",
        message:`Could not find the '${sobran[0]}' column of 'viajes' in the schema cache` } };
      TABLA.set(fila.id, { ...fila });
      return { error:null };
    },
    async select(){ return red.falla ? { data:null, error:red.falla }
                                     : { data:[...TABLA.values()], error:null }; },
    update(campos){ return { eq: async (_col, id) => {
      if (red.falla || red.fallaBorrado) return { error:red.falla || red.fallaBorrado };
      const f = TABLA.get(id);
      if (f) TABLA.set(id, { ...f, ...campos });
      return { error:null };
    } }; }
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
  SYNC.conectar = async () => red.conectada ? cliente : null;
  SYNC.sesion = { user:{ email:"prueba@ejemplo" } };
  return { SYNC, TABLA, almacen, red };
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

  // Un fallo pasajero no es lo mismo que una columna que no existe
  {
    const { SYNC, TABLA, red } = montarNube();
    const v = viajeDePrueba();
    SYNC.guardarLocales([v]);

    red.falla = { code:"XX000", message:"el servidor no está disponible" };
    const primera = await SYNC.subir(v);
    comprobar("un fallo del servidor no sube el viaje",
              primera === false && SYNC.pendientes().includes("p9"), "no quedó pendiente");
    comprobar("y no se confunde con «la columna extra no existe»",
              SYNC.hayExtra === true, "dejó de mandar los bloques del viaje por un fallo de red");

    red.falla = null;
    await SYNC.subir(v);
    comprobar("cuando el servidor vuelve, los bloques del viaje suben con él",
              !!(TABLA.get("p9") && TABLA.get("p9").extra && TABLA.get("p9").extra.reservas),
              "subió sin los bloques");
  }

  // Con la columna de verdad ausente, sí se reintenta sin ella
  {
    const { SYNC, TABLA } = montarNube({ columnasViejas:true });
    const v = viajeDePrueba();
    SYNC.guardarLocales([v]);
    await SYNC.subir(v);
    comprobar("si la columna no existe de verdad, se sube sin ella",
              TABLA.has("p9") && !("extra" in TABLA.get("p9")), "no reintentó sin la columna");
    comprobar("y se recuerda para no repetir el intento",
              SYNC.hayExtra === false, "seguiría intentándolo en cada subida");
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
        let t = null;
        try { t = JSON.parse(almacen.traspaso_viaje || "null"); } catch {}
        comprobar(`${app.nombre}: al editar, deja el viaje para el editor con su id de siempre`,
                  !!(t && t.id === app.carpeta && t.vale && t.viaje), "no dejó nada que el editor pueda recoger");
        if (t && t.viaje){
          const perdido = loQueFalta(original, t.viaje);
          comprobar(`${app.nombre}: lo que deja es el viaje entero`, perdido === null, `se perdió «${perdido}»`);
          comprobar(`${app.nombre}: lleva la guía de lugares`,
                    Array.isArray(t.viaje.guia) && t.viaje.guia.length > 0, "la guía no viajó");
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

    // Y se puede volver atrás: quitar la copia devuelve el viaje del archivo
    {
      const editado = { id:app.carpeta, nombre:"Cambiado a mano", desde:"", hasta:"", salida:"",
                        dias:[{ t:"Un solo día", dest:"Donde sea", paradas:[{ h:"10:00", txt:"Parada única" }] }],
                        actualizado:"2030-01-01T00:00:00.000Z" };
      const almacen = { viajes_propios: JSON.stringify([editado, { id:"otro", nombre:"Otro viaje", dias:[] }]) };
      const { dom, d } = await nombreQuePinta(app, almacen);
      const volver = d.getElementById("btn-original");
      comprobar(`${app.nombre}: editado, ofrece volver al viaje original`, !!volver, "no está el botón");
      if (volver){
        dom.window.confirm = () => true;
        volver.click();
        await esperar(150);
        const quedan = JSON.parse(almacen.viajes_propios || "[]");
        comprobar(`${app.nombre}: volver al original quita solo su copia`,
                  quedan.length === 1 && quedan[0].id === "otro",
                  `quedaron: ${quedan.map(v => v.id).join(", ")}`);
      }
    }

    // Sin copia guardada no se ofrece volver a ningún sitio
    {
      const { d } = await nombreQuePinta(app, {});
      comprobar(`${app.nombre}: sin editar, no se ofrece volver al original`,
                !d.getElementById("btn-original"), "el botón sobra");
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

/* ---- 13. La portada no repite un viaje que ya tiene su app ----
   Al hacer editable Eslovenia o Asturias, su viaje entra en los viajes
   del móvil. Sin cuidado, la portada lo listaría dos veces: una a su app
   y otra al visor genérico. */
async function portadaSinRepetidos(){
  console.log(`\n${gris("──")} La portada no repite viajes`);

  const almacen = { viajes_propios: JSON.stringify([
    { id:"eslovenia", nombre:"Eslovenia · Venecia", desde:"2026-07-18", hasta:"2026-07-29",
      dias:[{ t:"Un día", paradas:[{ txt:"Una parada" }] }] },
    { id:"v1propio", nombre:"Un viaje mío", desde:"", hasta:"",
      dias:[{ t:"Un día", paradas:[{ txt:"Una parada" }] }] }
  ])};
  const dom = abrir("index.html", { url:"https://x/", almacen, conexion:false });
  await esperar(500);
  const d = dom.window.document;
  const enlaces = [...d.querySelectorAll("#lista a")].map(a => a.getAttribute("href"));

  comprobar("Eslovenia aparece una sola vez",
            enlaces.filter(h => /eslovenia/.test(h)).length === 1,
            `enlaces: ${enlaces.join(" · ")}`);
  comprobar("y sigue llevando a su propia app",
            enlaces.includes("eslovenia/"), `enlaces: ${enlaces.join(" · ")}`);
  comprobar("los viajes creados siguen apareciendo",
            enlaces.includes("viaje/?id=v1propio"), `enlaces: ${enlaces.join(" · ")}`);
  comprobar("la portada no dio errores", dom.errores.length === 0, dom.errores[0]);
}

/* ---- 14. Una copia incompleta de la nube no puede borrar los bloques ----
   Segundo móvil, base de datos sin la columna `extra`: el primero sube solo
   las columnas antiguas, así que el registro que baja el segundo tiene días
   pero no guía, ni vuelos, ni seguros. Si esa copia sustituyera al archivo,
   el viaje perdería casi todo en el móvil que no lo editó. */
async function contenidoDeVista(app, almacen, pestana){
  const dom = abrir(`${app.carpeta}/index.html`, { url:app.url, almacen, conexion:false, ...app.opciones });
  await esperar(400);
  const d = dom.window.document;
  [...d.querySelectorAll("nav button")].find(b => b.dataset.v === pestana)?.click();
  await esperar(200);
  return { dom, html: d.getElementById("v-" + pestana)?.innerHTML || "",
           cabecera: d.querySelector("header")?.textContent || "" };
}

/* Lo que sube un móvil contra una base antigua: solo las columnas de siempre */
function comoLoBajaUnaBaseAntigua(original, id){
  return { id, nombre:original.nombre, desde:original.desde || "", hasta:original.hasta || "",
           salida:original.salida || "", dias:original.dias, actualizado:"2030-01-01T00:00:00.000Z" };
}

async function copiaIncompletaNoBorraBloques(){
  console.log(`\n${gris("──")} Una copia incompleta no borra los bloques del archivo`);

  for (const app of A_MEDIDA){
    const original = datosOriginales(app.carpeta);
    const truncado = comoLoBajaUnaBaseAntigua(original, app.carpeta);
    const almacen = { viajes_propios: JSON.stringify([truncado]) };

    comprobar(`${app.nombre}: el registro de la base antigua no trae guía`,
              !truncado.guia, "la prueba no está simulando lo que quiere simular");

    const guia = await contenidoDeVista(app, almacen, "guia");
    const fichas = (original.guia || []).reduce((n, z) => n + (z.lugares || []).length, 0);
    comprobar(`${app.nombre}: la guía sigue enseñando sus ${fichas} fichas`,
              guia.cabecera.includes(`${fichas} sitios`),
              `la cabecera decía: ${guia.cabecera.replace(/\s+/g," ").slice(0,90)}`);
    comprobar(`${app.nombre}: la pestaña Guía sigue con contenido`,
              guia.html.length > 2000, `solo ${guia.html.length} caracteres`);
    comprobar(`${app.nombre}: sin errores con el registro incompleto`,
              guia.dom.errores.length === 0, guia.dom.errores[0]);
  }

  // Eslovenia además tiene reservas, que es lo que más duele perder
  {
    const app = A_MEDIDA.find(a => a.carpeta === "eslovenia");
    const original = datosOriginales("eslovenia");
    const almacen = { viajes_propios: JSON.stringify([comoLoBajaUnaBaseAntigua(original, "eslovenia")]) };
    const r = await contenidoDeVista(app, almacen, "reservas");
    comprobar("Eslovenia: el localizador del vuelo sigue ahí",
              r.html.includes(original.vuelos[0].loc), "la pestaña Reservas se quedó sin vuelos");
    comprobar("Eslovenia: los seguros siguen ahí",
              r.html.includes(original.seguros[0].poliza), "la pestaña Reservas se quedó sin seguros");
  }

  // Y lo que la copia SÍ trae tiene que seguir mandando
  {
    const app = A_MEDIDA.find(a => a.carpeta === "asturias");
    const editado = { id:"asturias", nombre:"Cambiado a mano", desde:"", hasta:"", salida:"",
                      dias:[{ t:"Un solo día", dest:"Donde sea", paradas:[{ h:"10:00", txt:"Parada única" }] }],
                      actualizado:"2030-01-01T00:00:00.000Z" };
    const { cabecera } = await contenidoDeVista(app, { viajes_propios: JSON.stringify([editado]) }, "guia");
    comprobar("Asturias: lo editado sigue mandando sobre el archivo",
              cabecera.includes("Cambiado a mano"), `la cabecera decía: ${cabecera.replace(/\s+/g," ").slice(0,90)}`);
  }
}

/* ---- 15. El traspaso al editor comprueba que ha llegado ----
   En iOS, una app añadida a la pantalla de inicio tiene su propio almacén,
   separado del de Safari: WebKit lo confirma como intencional. Si al abrir
   el editor se sale del contenedor de la app, el viaje no llega.

   Aquí se simulan los dos casos dando a cada página un almacén distinto,
   que es justo lo que las pruebas de antes no hacían: compartían uno solo
   y por eso el traspaso siempre parecía funcionar. */
async function pulsaEditar(app, almacenApp){
  const dom = abrir(`${app.carpeta}/index.html`, { url:app.url, almacen:almacenApp, conexion:false, ...app.opciones });
  await esperar(400);
  const d = dom.window.document;
  [...d.querySelectorAll("nav button")].find(b => b.dataset.v === "info")?.click();
  await esperar(150);
  const b = d.getElementById("btn-editar");
  if (b) b.click();
  await esperar(150);
  let t = null;
  try { t = JSON.parse(almacenApp.traspaso_viaje || "null"); } catch {}
  return { dom, d, vale: t && t.vale };
}

async function abreEditor(almacenEditor, busqueda){
  const dom = abrir("crear/index.html", { url:"https://x/crear/" + busqueda, almacen:almacenEditor, conexion:false });
  await esperar(400);
  const d = dom.window.document;
  return { dom, d,
           titulo: d.getElementById("titulo")?.textContent || "",
           sub: d.getElementById("sub")?.textContent || "",
           nombre: d.getElementById("nombre")?.value || "" };
}

async function traspasoComprobado(){
  console.log(`\n${gris("──")} El traspaso al editor comprueba que ha llegado`);

  for (const app of A_MEDIDA){
    const original = datosOriginales(app.carpeta);

    // ── Caso 1: mismo almacén (Safari normal, o app instalada que no sale) ──
    {
      const almacen = {};
      const { vale } = await pulsaEditar(app, almacen);
      comprobar(`${app.nombre}: al pulsar editar deja un traspaso`, !!vale, "no dejó nada");

      const ed = await abreEditor(almacen, `?id=${app.carpeta}&traspaso=${vale}`);
      comprobar(`${app.nombre}: con el almacén compartido, el editor abre el viaje`,
                ed.nombre === original.nombre, `el editor abrió «${ed.nombre}»`);
      comprobar(`${app.nombre}: y deja acuse de recibo`,
                almacen.traspaso_ok === "1", "no dejó acuse");
      comprobar(`${app.nombre}: el traspaso se consume, no se queda ahí`,
                !almacen.traspaso_viaje, "el traspaso siguió sin recoger");
      comprobar(`${app.nombre}: el editor no dio errores`, ed.dom.errores.length === 0, ed.dom.errores[0]);
    }

    // ── Caso 2: almacenes separados (app instalada que sale a Safari) ──
    {
      const almacenApp = {}, almacenEditor = {};      // dos contenedores distintos
      const { vale } = await pulsaEditar(app, almacenApp);
      const ed = await abreEditor(almacenEditor, `?id=${app.carpeta}&traspaso=${vale}`);

      comprobar(`${app.nombre}: con los almacenes separados, el editor lo dice`,
                ed.titulo === "No he podido traer el viaje", `el título decía «${ed.titulo}»`);
      comprobar(`${app.nombre}: y no finge que el viaje esté ahí`,
                ed.nombre === "", `el editor abrió «${ed.nombre}»`);
      comprobar(`${app.nombre}: sin acuse de recibo`,
                almacenEditor.traspaso_ok !== "1" && almacenApp.traspaso_ok !== "1", "dejó acuse sin haberlo recibido");
      comprobar(`${app.nombre}: el editor no dio errores al avisar`,
                ed.dom.errores.length === 0, ed.dom.errores[0]);

      // Al volver a la app, el traspaso sigue sin recoger: ofrece copiar
      const dom2 = abrir(`${app.carpeta}/index.html`, { url:app.url, almacen:almacenApp, conexion:false, ...app.opciones });
      await esperar(400);
      const d2 = dom2.window.document;
      [...d2.querySelectorAll("nav button")].find(b => b.dataset.v === "info")?.click();
      await esperar(150);
      comprobar(`${app.nombre}: al volver, la app ofrece copiar el viaje`,
                !!d2.getElementById("btn-copiar"), "sigue ofreciendo el camino que no funciona");
      comprobar(`${app.nombre}: y lo explica en vez de callarse`,
                (d2.getElementById("v-info")?.textContent || "").includes("no ha recibido el viaje"),
                "no explica por qué");
    }
  }

  // ── Si el traspaso ya funcionó aquí, volver atrás no es un fallo ──
  {
    const app = A_MEDIDA[0];
    const original = datosOriginales(app.carpeta);
    const almacen = { traspaso_ok:"1",
      traspaso_viaje: JSON.stringify({ vale:"t1", id:app.carpeta, viaje:original }) };
    const dom = abrir(`${app.carpeta}/index.html`, { url:app.url, almacen, conexion:false, ...app.opciones });
    await esperar(400);
    const d = dom.window.document;
    [...d.querySelectorAll("nav button")].find(b => b.dataset.v === "info")?.click();
    await esperar(150);
    comprobar(`${app.nombre}: con el camino ya comprobado, no se avisa de un fallo que no hubo`,
              !d.getElementById("btn-copiar") && !!d.getElementById("btn-editar"),
              "dio por roto un camino que ya había funcionado");
  }

  // ── Abrir el editor pidiendo un viaje que no existe tampoco finge ──
  {
    const ed = await abreEditor({}, "?id=noexiste");
    comprobar("pedir un viaje que no está: el editor lo dice",
              ed.titulo === "No he podido traer el viaje", `el título decía «${ed.titulo}»`);
  }

  // ── Y el editor normal, sin parámetros, sigue como estaba ──
  {
    const ed = await abreEditor({}, "");
    comprobar("sin parámetros, el editor sigue siendo un viaje nuevo",
              ed.titulo === "Nuevo viaje", `el título decía «${ed.titulo}»`);
  }
}

/* ---- 16. Un viaje borrado no resucita ----
   Borrar sin cobertura no puede quedarse en nada: si el borrado no llega a
   la nube, la fila remota sigue viva y en la siguiente sincronización el
   viaje vuelve. Se apunta como pendiente y se reintenta. */
function dosViajes(){
  return [
    { id:"asturias", nombre:"Asturias occidental", desde:"", hasta:"", salida:"",
      dias:[{ t:"Día uno", paradas:[{ txt:"Una parada" }] }],
      guia:[{ zona:"Somiedo", lugares:[{ id:"teitos", n:"Teitos" }] }],
      actualizado:"2026-01-01T10:00:00.000Z" },
    { id:"otro", nombre:"Un viaje que no se toca", desde:"", hasta:"", salida:"",
      dias:[{ t:"Día uno", paradas:[{ txt:"Otra parada" }] }],
      actualizado:"2026-01-01T10:00:00.000Z" }
  ];
}

async function conDosViajesSubidos(opciones){
  const nube = montarNube(opciones);
  nube.SYNC.guardarLocales(dosViajes());
  for (const v of dosViajes()) await nube.SYNC.subir(v);
  // el diario y las fotos van aparte: tienen que sobrevivir al borrado
  nube.almacen["diario_asturias"] = JSON.stringify({ hechas:{ "0:0":1 }, notas:{ "0":"una nota" } });
  return nube;
}

const sigueViva = (TABLA, id) => TABLA.has(id) && !TABLA.get(id).borrado;

async function elBorradoNoResucita(){
  console.log(`\n${gris("──")} Un viaje borrado no resucita`);

  // Con cobertura: se borra y se acabó
  {
    const { SYNC, TABLA, almacen } = await conDosViajesSubidos();
    SYNC.guardarLocales(SYNC.locales().filter(v => v.id !== "asturias"));
    const ok = await SYNC.borrar("asturias");
    comprobar("con cobertura, el borrado se aplica", ok === true, "borrar() devolvió false");
    comprobar("y no queda apuntado como pendiente",
              SYNC.borrados().length === 0, `quedaron: ${SYNC.borrados().join(", ")}`);
    await SYNC.sincronizar();
    comprobar("tras sincronizar, el viaje no vuelve",
              !SYNC.locales().some(v => v.id === "asturias"), "el viaje resucitó");
    comprobar("el otro viaje sigue intacto",
              SYNC.locales().some(v => v.id === "otro"), "se llevó por delante otro viaje");
    comprobar("el diario no se toca", !!almacen["diario_asturias"], "borró el diario");
  }

  // Sin cobertura: queda apuntado, y al volver la conexión se aplica
  {
    const { SYNC, TABLA, almacen, red } = await conDosViajesSubidos();
    red.conectada = false;
    SYNC.guardarLocales(SYNC.locales().filter(v => v.id !== "asturias"));
    const ok = await SYNC.borrar("asturias");
    comprobar("sin cobertura, el borrado no se pierde: queda apuntado",
              ok === false && SYNC.borrados().includes("asturias"), "no quedó apuntado");
    comprobar("sin cobertura, la fila remota sigue viva todavía",
              sigueViva(TABLA, "asturias"), "la prueba no simula lo que quiere simular");
    comprobar("el diario sigue sin tocarse", !!almacen["diario_asturias"], "borró el diario");

    // vuelve la conexión
    red.conectada = true;
    await SYNC.sincronizar();
    comprobar("al volver la conexión, el borrado se aplica",
              !sigueViva(TABLA, "asturias"), "la fila remota siguió viva");
    comprobar("y el viaje no vuelve al móvil",
              !SYNC.locales().some(v => v.id === "asturias"), "el viaje resucitó");
    comprobar("la lápida se retira cuando ya no hace falta",
              SYNC.borrados().length === 0, `quedaron: ${SYNC.borrados().join(", ")}`);
    comprobar("el otro viaje sigue intacto",
              SYNC.locales().some(v => v.id === "otro") && sigueViva(TABLA, "otro"),
              "se llevó por delante otro viaje");
  }

  // El servidor falla un rato: se reintenta, no se da por hecho
  {
    const { SYNC, TABLA, red } = await conDosViajesSubidos();
    SYNC.guardarLocales(SYNC.locales().filter(v => v.id !== "asturias"));
    red.falla = { code:"XX000", message:"el servidor no está disponible" };
    await SYNC.borrar("asturias");
    comprobar("si el servidor falla, el borrado queda apuntado",
              SYNC.borrados().includes("asturias"), "no quedó apuntado");
    await SYNC.sincronizar();
    comprobar("y sigue apuntado mientras el servidor siga fallando",
              SYNC.borrados().includes("asturias"), "se dio por hecho sin confirmarlo");
    comprobar("el viaje tampoco vuelve mientras tanto",
              !SYNC.locales().some(v => v.id === "asturias"), "el viaje resucitó");

    red.falla = null;
    await SYNC.sincronizar();
    comprobar("cuando el servidor vuelve, el borrado se aplica",
              !sigueViva(TABLA, "asturias"), "la fila remota siguió viva");
    comprobar("y la lápida se retira", SYNC.borrados().length === 0, "quedó apuntado de más");
  }

  // El borrado no se aplica pero el resto de la sincronización sí funciona:
  // ahí es donde el viaje volvería si el bucle de remotos no lo filtrara
  {
    const { SYNC, TABLA, red } = await conDosViajesSubidos();
    SYNC.guardarLocales(SYNC.locales().filter(v => v.id !== "asturias"));
    red.fallaBorrado = { code:"42501", message:"no tienes permiso para modificar esa fila" };
    await SYNC.borrar("asturias");

    await SYNC.sincronizar();     // lee y escribe bien, pero el borrado sigue sin poder aplicarse
    comprobar("si el borrado no se aplica, el viaje no vuelve al móvil igualmente",
              !SYNC.locales().some(v => v.id === "asturias"), "el viaje resucitó");
    comprobar("y el borrado sigue apuntado para más tarde",
              SYNC.borrados().includes("asturias"), "se perdió el borrado");
    comprobar("el otro viaje no se ve afectado",
              SYNC.locales().some(v => v.id === "otro"), "se llevó por delante otro viaje");

    red.fallaBorrado = null;
    await SYNC.sincronizar();
    comprobar("y cuando se puede, se aplica",
              !sigueViva(TABLA, "asturias"), "la fila remota siguió viva");
  }

  // Borrar gana sobre un cambio que estaba pendiente de subir
  {
    const { SYNC, TABLA, red } = await conDosViajesSubidos();
    red.conectada = false;
    const v = SYNC.locales().find(x => x.id === "asturias");
    v.nombre = "Cambiado sin cobertura";
    SYNC.guardarLocales(SYNC.locales().map(x => x.id === "asturias" ? v : x));
    await SYNC.subir(v);                       // falla: queda pendiente de subir
    comprobar("el cambio sin cobertura queda pendiente de subir",
              SYNC.pendientes().includes("asturias"), "no quedó pendiente");

    SYNC.guardarLocales(SYNC.locales().filter(x => x.id !== "asturias"));
    await SYNC.borrar("asturias");
    red.conectada = true;
    await SYNC.sincronizar();
    comprobar("borrar manda sobre el cambio pendiente: no lo resucita",
              !sigueViva(TABLA, "asturias"), "el cambio pendiente lo revivió");
    comprobar("y deja de estar pendiente de subir",
              !SYNC.pendientes().includes("asturias"), "siguió pendiente de subir");
  }
}

/* ---- 17. Ningún botón se queda esperando para siempre ----
   La regla de la casa: «un botón que se queda en Cargando… para siempre
   es un fallo grave». Hasta ahora ninguno se desactivaba tampoco, así que
   todos admitían doble pulsación. */

/* Un service worker que no responde nunca */
function swColgado(){
  const nunca = () => new Promise(() => {});
  return { getRegistration: nunca, getRegistrations: nunca,
           register: nunca, addEventListener(){}, controller:null };
}

async function nadaSeQuedaEsperando(){
  console.log(`\n${gris("──")} Ningún botón se queda esperando para siempre`);

  // El botón de auto-rescate de la portada, con el service worker colgado
  {
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true,
                                      swPropio: swColgado() });
    await esperar(400);
    const d = dom.window.document;
    const b = d.getElementById("btn-actualizar");
    comprobar("la portada tiene botón de actualizar", !!b, "no está");
    if (!b) return;

    b.click();
    await esperar(80);
    comprobar("mientras limpia, el botón se desactiva",
              b.disabled === true, "se puede pulsar otra vez y volver a limpiar");
    comprobar("y dice lo que está haciendo a un lector de pantalla",
              b.getAttribute("aria-busy") === "true", "sin aria-busy");

    // Y no se queda ahí: el tope lo saca. Se espera un número literal
    // porque un `const` de un script normal no se cuelga de window, y
    // leerlo de ahí daría NaN y una espera de cero.
    await esperar(4400);
    comprobar("con el service worker colgado, el botón no se queda en «Limpiando…»",
              b.textContent !== "Limpiando…", `se quedó en «${b.textContent}»`);
    comprobar("y llega a recargar de todas formas",
              b.textContent === "Recargando…", `quedó en «${b.textContent}»`);
    comprobar("la portada no dio errores", dom.errores.length === 0, dom.errores[0]);
  }

  // Una petición que no responde termina por tope, y aborta de verdad
  {
    const dom = abrir("crear/index.html", { url:"https://x/crear/", almacen:{}, conexion:true });
    await esperar(300);
    const w = dom.window;

    let abortada = false, recibioSenal = false;
    w.fetch = (url, o) => new Promise((_, mal) => {
      recibioSenal = !!(o && o.signal);
      if (o && o.signal) o.signal.addEventListener("abort", () => {
        abortada = true;
        mal(Object.assign(new Error("abortada"), { name:"AbortError" }));
      });
    });

    const t0 = Date.now();
    let motivo = "";
    try { await w.fetchConTope("https://ejemplo/foto.jpg", 150); }
    catch (e){ motivo = e.message; }
    const tardo = Date.now() - t0;

    comprobar("una petición que nunca responde termina por tope",
              tardo < 1500, `tardó ${tardo} ms`);
    comprobar("la petición lleva señal de aborto", recibioSenal, "se pidió sin signal");
    comprobar("y se aborta de verdad", abortada === true, "nunca se llamó a abort()");
    comprobar("el motivo se explica en castellano",
              motivo === "tardó demasiado", `dijo «${motivo}»`);
  }

  // Sin cobertura se dice enseguida, sin esperar al tope
  {
    const dom = abrir("crear/index.html", { url:"https://x/crear/", almacen:{}, conexion:false });
    await esperar(300);
    const w = dom.window;
    w.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    const t0 = Date.now();
    let motivo = "";
    try { await w.fetchConTope("https://ejemplo/foto.jpg", 9000); }
    catch (e){ motivo = e.message; }
    comprobar("sin cobertura se avisa enseguida, sin agotar el tope",
              Date.now() - t0 < 1000, "esperó al tope");
    comprobar("y dice que es por cobertura", motivo === "sin cobertura", `dijo «${motivo}»`);
  }

  // El botón de la foto: se desactiva, vuelve, y deja reintentar
  {
    const dom = abrir("crear/index.html", { url:"https://x/crear/", almacen:{}, conexion:true });
    await esperar(300);
    const d = dom.window.document, w = dom.window;

    const b = d.createElement("button");
    b.textContent = "Usar la foto";
    d.body.appendChild(b);

    let veces = 0;
    const tarea = () => { veces++; return new Promise(r => setTimeout(r, 120)); };

    const p1 = w.trabajando(b, "Guardando…", tarea, { fallo:"No se pudo guardar" });
    await esperar(20);
    comprobar("el botón de la foto se desactiva mientras baja",
              b.disabled === true && b.textContent === "Guardando…", `quedó «${b.textContent}»`);
    w.trabajando(b, "Guardando…", tarea, { fallo:"No se pudo guardar" });   // segundo toque
    await esperar(20);
    comprobar("dos pulsaciones no lanzan dos descargas", veces === 1, `se lanzó ${veces} veces`);
    await p1; await esperar(30);
    comprobar("al terminar, el botón vuelve a su texto",
              b.disabled === false && b.textContent === "Usar la foto", `quedó «${b.textContent}»`);

    // y cuando falla
    await w.trabajando(b, "Guardando…", async () => { throw new Error("tardó demasiado"); },
                       { fallo:"No se pudo guardar", vuelve:150 });
    comprobar("si falla, el botón dice el motivo",
              b.textContent === "No se pudo guardar · tardó demasiado", `dijo «${b.textContent}»`);
    comprobar("y se puede reintentar en el acto", b.disabled === false, "quedó bloqueado");
    await esperar(250);
    comprobar("y después vuelve a su texto de siempre",
              b.textContent === "Usar la foto", `quedó «${b.textContent}»`);
  }

  // «Estoy aquí»: dos toques seguidos no pueden guardar dos visitas
  {
    const almacen = {};
    const dom = abrir("eslovenia/index.html", { url:"https://x/eslovenia/", almacen,
      conexion:false, fecha:"2026-07-25T12:00:00", posicion:[46.36, 14.11] });
    await esperar(400);
    const d = dom.window.document, w = dom.window;

    // Se cuenta cuántas veces se pide de verdad la posición. Mirar solo
    // cuántas visitas quedan guardadas NO vale: dos toques a la vez leen el
    // diario antes de que el otro escriba, se pisan, y queda una sola. La
    // prueba pasaría con el fallo puesto.
    let pedidas = 0;
    w.navigator.geolocation = { getCurrentPosition: ok => {
      pedidas++;
      setTimeout(() => ok({ coords:{ latitude:46.36, longitude:14.11 } }), 60);
    } };

    const b = d.querySelector("[data-aqui]");
    comprobar("«Estoy aquí» está en el día", !!b, "no está el botón");
    if (b){
      // Sin esperar: `trabajando` desactiva antes del primer await, y si se
      // espera, la operación ya ha terminado y ha repintado el botón.
      b.click();
      comprobar("mientras localiza, el botón se desactiva", b.disabled === true, "admite otro toque");
      b.click();                                   // segundo toque, a propósito
      await esperar(600);
      comprobar("dos toques no lanzan dos veces la operación",
                pedidas === 1, `se pidió la posición ${pedidas} veces`);
      const todas = (JSON.parse(almacen["diario_eslovenia"] || "{}").visitas || []);
      comprobar("y queda una sola visita guardada",
                todas.length === 1, `se guardaron ${todas.length}`);
      comprobar("y el botón vuelve a su sitio",
                b.disabled === false, "quedó bloqueado");
    }
    comprobar("sin errores al apuntar dónde estamos", dom.errores.length === 0, dom.errores[0]);
  }

  // conTope corta de verdad una promesa que no termina nunca
  {
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true });
    await esperar(300);
    const w = dom.window;
    const t0 = Date.now();
    const r = await w.conTope(new Promise(() => {}), 120, { error:{ message:"la nube no responde" } });
    comprobar("una promesa que no termina se corta por tope",
              Date.now() - t0 < 1200, `tardó ${Date.now() - t0} ms`);
    comprobar("y devuelve el fallo con motivo, no un cuelgue",
              r && r.error && r.error.message === "la nube no responde", JSON.stringify(r));
  }

  // Ninguna llamada a la nube puede quedarse sin tope. Es comprobación de
  // código, no de ejecución: los topes reales son de 15 s y esperar a que
  // salten haría la suite inútilmente lenta. Lo que vigila es que nadie
  // añada mañana una llamada suelta.
  {
    const codigo = fs.readFileSync(path.join(RAIZ, "sync.js"), "utf8");
    const sueltas = [...codigo.matchAll(/await\s+c\.from\(/g)].length;
    comprobar("ninguna llamada a Supabase se hace sin tope",
              sueltas === 0, `${sueltas} llamadas con «await c.from(» sin conTope`);
    const conTopeadas = [...codigo.matchAll(/conTope\(\s*c\.from\(/g)].length;
    comprobar("y las que hay van todas envueltas",
              conTopeadas >= 4, `solo ${conTopeadas} envueltas`);
  }

  // El editor no puede decir «sincronizado» si solo está en el móvil
  {
    const almacen = {};
    const dom = abrir("crear/index.html", { url:"https://x/crear/", almacen, conexion:false });
    await esperar(350);
    const d = dom.window.document, w = dom.window;
    const nombre = d.getElementById("nombre");
    nombre.value = "Viaje sin cobertura";
    nombre.dispatchEvent(new w.Event("input", { bubbles:true }));
    d.getElementById("add-dia").click();
    await esperar(40);
    d.getElementById("guardar").click();
    await esperar(400);

    const texto = d.getElementById("estado").textContent;
    comprobar("sin cobertura dice que está guardado en el móvil",
              /guardado/i.test(texto), `dijo «${texto}»`);
    comprobar("y NO dice que esté sincronizado",
              !/sincronizado/i.test(texto), `dijo «${texto}»`);
    comprobar("y avisa de que subirá cuando haya conexión",
              /conexi[oó]n|subir/i.test(texto), `dijo «${texto}»`);
    comprobar("pero el viaje sí está guardado de verdad en el móvil",
              (JSON.parse(almacen.viajes_propios || "[]")).length === 1, "no se guardó");
  }

  // Y por el camino normal sigue funcionando
  {
    const sw = { getRegistration: async () => null, getRegistrations: async () => [],
                 register: async () => ({ update(){}, addEventListener(){} }),
                 addEventListener(){}, controller:null };
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true, swPropio: sw });
    await esperar(400);
    const b = dom.window.document.getElementById("btn-actualizar");
    b.click();
    await esperar(300);
    comprobar("sin service workers que limpiar, recarga igual",
              b.textContent === "Recargando…", `quedó en «${b.textContent}»`);
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
  await idsSinRepetir();
  posicionEnDosFormas();
  await nadaSePierdeEnLaNube();
  dependenciasEnServiceWorker();
  await editorConservaTodo();
  await viajesAMedidaEditables();
  await portadaSinRepetidos();
  await copiaIncompletaNoBorraBloques();
  await nadaSeQuedaEsperando();
  await traspasoComprobado();
  await elBorradoNoResucita();

  console.log("\n" + gris("─".repeat(52)));
  if (fallos === 0) console.log(`  ${verde("Todo correcto")} · ${pruebas} comprobaciones\n`);
  else console.log(`  ${rojo(fallos + " fallo(s)")} de ${pruebas} comprobaciones\n`);
  process.exit(fallos ? 1 : 0);
})();
