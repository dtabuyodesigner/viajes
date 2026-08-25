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
    swPropio = null,             // para simular un service worker que se cuelga
    supabasePropio = null,       // para simular login/logout colgados
    conFotos = false             // IndexedDB y las piezas que usa comprimirFoto
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
      if (conFotos){
        // Guardar una foto pasa por FileReader, Image, canvas e IndexedDB.
        // jsdom no trae ninguno de los cuatro.
        const FDB = require("fake-indexeddb");
        w.indexedDB = new FDB.IDBFactory();
        w.IDBKeyRange = FDB.IDBKeyRange;
        w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage(){} });
        w.HTMLCanvasElement.prototype.toDataURL = () => "data:image/jpeg;base64,FOTO";
        w.Image = class { set src(v){ this.width = 1200; this.height = 900;
          setTimeout(() => this.onload && this.onload(), 5); } };
        w.FileReader = class {
          readAsDataURL(){ setTimeout(() => { this.result = "x"; this.onload && this.onload(); }, 5); }
        };
      }
      w.supabase = supabasePropio || { createClient: () => ({
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

/* ---- 18. Cómo está el viaje: un solo modelo para las cinco apps ---- */

/* Un almacén de cachés de mentira, para poder decir la verdad sobre
   el uso sin cobertura sin depender de un navegador de verdad. */
function cachesDeMentira(guardado = {}){
  const abiertas = [];
  return {
    abiertas,
    api: {
      async keys(){ return Object.keys(guardado); },
      async open(nombre){
        abiertas.push(nombre);
        const dentro = guardado[nombre] || [];
        return { async match(url){ return dentro.includes(url) ? { ok:true } : undefined; } };
      }
    }
  };
}

const TODAS_GUARDADAS = {
  "portada-v13":     ["https://x/index.html"],
  "eslovenia26-v15": ["https://x/eslovenia/index.html"],
  "asturias26-v14":  ["https://x/asturias/index.html"],
  "generico-v9":     ["https://x/viaje/index.html"],
  "editor-v9":       ["https://x/crear/index.html"]
};

async function elEstadoSeSabeDeVerdad(){
  console.log(`\n${gris("──")} Cómo está el viaje, en un solo sitio`);

  const abrirPortada = (opciones = {}) =>
    abrir("index.html", { url:"https://x/", almacen:{}, ...opciones });

  // ── El resumen dice lo que toca en cada caso ──
  {
    const dom = abrirPortada();
    await esperar(300);
    const w = dom.window;

    const caso = (e) => w.resumenDeEstado(e);
    const base = { guarda:true, porSubir:{viajes:0,borrados:0,fotos:0}, total:0, offline:null };

    let r = caso({ ...base, nube:{ clase:"conectada", txt:"Sincronizado" } });
    comprobar("con las colas vacías, el resumen es verde",
              r.nivel === "bien", `nivel «${r.nivel}»`);
    comprobar("y nombra SOLO lo que se puede comprobar",
              r.txt === "Viajes y fotos al día", `dijo «${r.txt}»`);
    comprobar("no da una garantía que incluya el diario",
              !/a salvo|todo (subido|sincronizado)|lo ve el otro/i.test(r.txt), `dijo «${r.txt}»`);
    comprobar("y no ofrece ninguna acción, porque no hay nada que hacer",
              r.accion === null, `ofrecía «${r.accion}»`);

    r = caso({ ...base, porSubir:{viajes:2,borrados:0,fotos:0}, total:2,
               nube:{ clase:"conectada", txt:"2 viajes por subir" } });
    comprobar("con viajes pendientes, lo cuenta",
              /2 viajes por subir/.test(r.txt), `dijo «${r.txt}»`);
    comprobar("y no se le llama al día", !/al día|a salvo/i.test(r.txt), `dijo «${r.txt}»`);
    comprobar("y ofrece reintentar", r.accion === "reintentar", `ofrecía «${r.accion}»`);

    r = caso({ ...base, porSubir:{viajes:1,borrados:0,fotos:3}, total:4,
               nube:{ clase:"sin-cobertura", txt:"Sin conexión · solo en este móvil" } });
    comprobar("sin cobertura, lo dice sin alarmar y cuenta lo que falta",
              /sin cobertura/i.test(r.txt) && /1 viaje y 3 fotos/.test(r.txt), `dijo «${r.txt}»`);
    comprobar("y no ofrece reintentar, porque no serviría de nada",
              r.accion === null, `ofrecía «${r.accion}»`);

    r = caso({ ...base, nube:{ clase:"sin-sesion", txt:"Sin sesión" } });
    comprobar("sin sesión, invita a entrar",
              r.accion === "entrar" && /solo en este móvil/i.test(r.txt), `dijo «${r.txt}»`);

    r = caso({ ...base, guarda:false, nube:{ clase:"conectada", txt:"Sincronizado" } });
    comprobar("si el móvil no deja guardar, eso manda sobre todo lo demás",
              r.nivel === "problema" && /no deja guardar/i.test(r.txt), `dijo «${r.txt}»`);

    r = caso({ ...base, nube:{ clase:"sin-respuesta", txt:"La nube no responde" } });
    comprobar("si la nube no responde, se puede reintentar",
              r.accion === "reintentar", `ofrecía «${r.accion}»`);

    comprobar("el nivel nunca viene solo como color: siempre trae glifo",
              ["✓","!"].includes(r.glifo), `glifo «${r.glifo}»`);
  }

  // ── Uso sin cobertura: solo se afirma con evidencia ──
  {
    const dom = abrirPortada();
    await esperar(300);
    const w = dom.window;

    // Sin Cache API no se puede saber, y eso NO es lo mismo que «no»
    comprobar("sin Cache API, no se inventa: se dice que no se sabe",
              (await w.listoSinCobertura()) === null, "afirmó algo sin poder saberlo");

    const falso = cachesDeMentira(TODAS_GUARDADAS);
    w.caches = falso.api;
    w.navigator.serviceWorker = { getRegistration: async () => ({}), addEventListener(){}, controller:{} };

    let r = await w.listoSinCobertura();
    comprobar("con las cinco guardadas, dice que está listo",
              r && r.listo === true && r.faltan.length === 0, JSON.stringify(r));

    // Y si falta una, la nombra
    const aMedias = { ...TODAS_GUARDADAS };
    delete aMedias["asturias26-v14"];
    w.caches = cachesDeMentira(aMedias).api;
    r = await w.listoSinCobertura();
    comprobar("si falta una app, no dice que esté listo",
              r && r.listo === false, JSON.stringify(r));
    comprobar("y dice cuál falta, por su nombre",
              r.faltan.includes("Asturias"), JSON.stringify(r.faltan));

    // Caché presente pero vacía: no vale como evidencia
    w.caches = cachesDeMentira({ ...TODAS_GUARDADAS, "asturias26-v14": [] }).api;
    r = await w.listoSinCobertura();
    comprobar("una caché vacía no cuenta como guardada",
              r && r.faltan.includes("Asturias"), JSON.stringify(r));
  }

  // ── No se abre ninguna caché que no exista ──
  {
    const dom = abrirPortada();
    await esperar(300);
    const w = dom.window;
    const falso = cachesDeMentira({ "portada-v13": ["https://x/index.html"] });
    w.caches = falso.api;
    w.navigator.serviceWorker = { getRegistration: async () => ({}), addEventListener(){}, controller:{} };
    await w.listoSinCobertura();
    comprobar("no se abre ninguna caché que no estuviera ya",
              falso.abiertas.every(n => n === "portada-v13"),
              `abrió: ${falso.abiertas.join(", ")}`);
  }
}

/* ---- 19. El centro de estado, en la portada ---- */
async function elCentroDeEstado(){
  console.log(`\n${gris("──")} El centro de estado`);

  const abre = async (opciones) => {
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, ...opciones });
    await esperar(500);
    return { dom, d:dom.window.document, w:dom.window };
  };

  // ── Sin cobertura ──
  {
    const { dom, d } = await abre({ conexion:false });
    const el = d.getElementById("nube");
    comprobar("el estado está en la portada", !!el, "no está");
    comprobar("y nunca se queda en «comprobando…»",
              el.textContent.trim() !== "comprobando…", `quedó «${el.textContent.trim()}»`);
    comprobar("sin cobertura lo dice",
              /sin cobertura/i.test(el.textContent), `dijo «${el.textContent.trim()}»`);
    comprobar("y NO dice que esté sincronizado",
              !/sincronizado|a salvo/i.test(el.textContent), `dijo «${el.textContent.trim()}»`);
    comprobar("y sin cobertura acota lo que afirma",
              /viajes y fotos/i.test(el.textContent) || /por subir/i.test(el.textContent),
              `dijo «${el.textContent.trim()}»`);
    comprobar("avisa a un lector de pantalla cuando cambia",
              el.getAttribute("aria-live") === "polite", "sin aria-live");
    comprobar("el glifo no se lee en voz alta: el texto ya lo dice",
              d.querySelector("#nube .est-glifo")?.getAttribute("aria-hidden") === "true",
              "el glifo se leería");
    comprobar("no distingue solo por color: trae glifo y nivel",
              !!d.querySelector("#nube .est-glifo") && !!el.dataset.nivel,
              "faltaba glifo o nivel");
    comprobar("la portada no dio errores", dom.errores.length === 0, dom.errores[0]);
  }

  // ── Se abre el detalle y trae acción ──
  {
    const { d } = await abre({ conexion:true, sesion:null });
    const el = d.getElementById("nube");
    comprobar("sin sesión, el resumen lo dice",
              /solo en este móvil/i.test(el.textContent), `dijo «${el.textContent.trim()}»`);
    comprobar("el detalle empieza cerrado",
              d.getElementById("estado-detalle").hidden === true, "estaba abierto");

    el.click();
    await esperar(120);
    const z = d.getElementById("estado-detalle");
    comprobar("al tocarlo se abre el detalle", z.hidden === false, "siguió cerrado");
    comprobar("y se anuncia que está abierto",
              el.getAttribute("aria-expanded") === "true", "sin aria-expanded");

    const texto = z.textContent;
    for (const fila of ["En este móvil", "Viajes y fotos", "Diario", "La nube", "Sin cobertura"])
      comprobar(`el detalle dice «${fila}»`, texto.includes(fila), `no estaba en: ${texto.slice(0,120)}`);

    comprobar("sin sesión, ofrece entrar",
              d.getElementById("est-accion")?.dataset.accion === "entrar", "no ofrecía entrar");

    // Y nada técnico
    for (const feo of ["supabase", "PGRST", "viaje_diario", "localStorage", "undefined"])
      comprobar(`el detalle no enseña «${feo}»`, !texto.includes(feo), `apareció en: ${texto.slice(0,140)}`);

    el.click();
    await esperar(80);
    comprobar("y se vuelve a cerrar tocándolo otra vez",
              z.hidden === true && el.getAttribute("aria-expanded") === "false", "siguió abierto");
  }

  // ── El resumen compacto en las otras cuatro apps ──
  {
    const conViaje = JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"", salida:"",
      dias:[{ t:"Día uno", dest:"Zagreb", paradas:[{ h:"Tarde", txt:"Una parada" }] }] }]);
    const otras = [
      { nombre:"editor",    ruta:"crear/index.html",     url:"https://x/crear/",     info:null },
      { nombre:"visor",     ruta:"viaje/index.html",     url:"https://x/viaje/?id=p1",
        info:"info", almacen:{ viajes_propios: conViaje } },
      { nombre:"Eslovenia", ruta:"eslovenia/index.html", url:"https://x/eslovenia/", info:"info",
        fecha:"2026-07-25T12:00:00" },
      { nombre:"Asturias",  ruta:"asturias/index.html",  url:"https://x/asturias/",  info:"info" }
    ];

    for (const app of otras){
      const dom = abrir(app.ruta, { url:app.url, almacen:app.almacen || {}, conexion:false,
                                    ...(app.fecha ? { fecha:app.fecha } : {}) });
      await esperar(400);
      const d = dom.window.document;
      if (app.info){
        [...d.querySelectorAll("nav button")].find(b => b.dataset.v === app.info)?.click();
        await esperar(250);
      }
      const linea = d.getElementById("est-linea");
      comprobar(`${app.nombre}: enseña el resumen de estado`, !!linea, "no está");
      if (linea){
        comprobar(`${app.nombre}: y no se queda en «comprobando…»`,
                  linea.textContent.trim() !== "comprobando…", `quedó «${linea.textContent.trim()}»`);
        comprobar(`${app.nombre}: dice lo mismo que la portada, sin cobertura`,
                  /sin cobertura|solo en este móvil/i.test(linea.textContent),
                  `dijo «${linea.textContent.trim()}»`);
        comprobar(`${app.nombre}: avisa al lector de pantalla`,
                  linea.getAttribute("aria-live") === "polite", "sin aria-live");
        linea.click();
        await esperar(100);
        comprobar(`${app.nombre}: se puede abrir el detalle`,
                  d.getElementById("est-mas")?.hidden === false, "no se abrió");
      }
      comprobar(`${app.nombre}: sin errores con el estado`, dom.errores.length === 0, dom.errores[0]);
    }
  }

  // ── Con un viaje pendiente de subir ──
  {
    const almacen = {
      viajes_propios: JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"", salida:"",
                                        dias:[{ t:"Día uno", paradas:[{ txt:"Una parada" }] }] }]),
      viajes_pendientes: JSON.stringify(["p1"])
    };
    const { d } = await abre({ conexion:false, almacen });
    const el = d.getElementById("nube");
    comprobar("con un viaje pendiente, lo cuenta",
              /1 viaje por subir/.test(el.textContent), `dijo «${el.textContent.trim()}»`);
    el.click();
    await esperar(120);
    comprobar("y sin cobertura no ofrece reintentar en vano",
              !d.getElementById("est-accion"), "ofrecía una acción que no serviría");
    comprobar("pero explica que suben solos",
              /suben solos|sube solo|subirá solo/i.test(d.getElementById("estado-detalle").textContent),
              "no lo explicaba");
  }
}

/* ---- 20. Entrar y salir: colgados y a dos toques (A5) ----
   Ninguna de las dos operaciones de sesión estaba vigilada: la
   comprobación estática de A1 mira las llamadas a los datos, no las de
   autenticación. */
function supabaseColgado(opciones = {}){
  const { entrar, salir, sesion = null } = opciones;
  const nunca = () => new Promise(() => {});
  const cuentas = { entrar:0, salir:0 };
  return { cuentas, api: { createClient: () => ({
    auth: {
      getSession: async () => ({ data:{ session:sesion } }),
      signInWithPassword: (...a) => { cuentas.entrar++; return entrar === "cuelga" ? nunca()
        : Promise.resolve({ data:{ session:{ user:{ email:"dani@ejemplo" } } }, error:null }); },
      signOut: () => { cuentas.salir++; return salir === "cuelga" ? nunca() : Promise.resolve({}); }
    },
    from: () => ({
      select: Object.assign(async () => ({ data:[], error:null }),
        { eq: () => ({ maybeSingle: async () => ({ data:null, error:null }) }) }),
      upsert: async () => ({ error:null }),
      update: () => ({ eq: async () => ({ error:null }) })
    })
  }) } };
}

async function entrarYSalirVigilados(){
  console.log(`\n${gris("──")} Entrar y salir, colgados y a dos toques`);

  // ── Entrar: el servidor no contesta nunca ──
  {
    const falso = supabaseColgado({ entrar:"cuelga" });
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true,
                                      supabasePropio: falso.api });
    await esperar(400);
    const d = dom.window.document;

    d.getElementById("nube").click();          // abre el detalle
    await esperar(120);
    (d.getElementById("est-accion") || {}).click?.();   // «Entrar con tu cuenta»
    await esperar(120);

    const b = d.getElementById("hacer-login");
    comprobar("se puede abrir el formulario de entrar", !!b, "no apareció");
    if (b){
      d.getElementById("correo").value = "dani@ejemplo";
      d.getElementById("clave").value = "loquesea";
      b.click();
      comprobar("mientras entra, el botón se desactiva", b.disabled === true, "admite otro toque");
      comprobar("y se anuncia que está trabajando",
                b.getAttribute("aria-busy") === "true", "sin aria-busy");
      b.click();                                // segundo toque, a propósito
      await esperar(200);
      comprobar("dos toques no lanzan dos intentos de entrar",
                falso.cuentas.entrar === 1, `se intentó ${falso.cuentas.entrar} veces`);
    }
    comprobar("la portada no dio errores al entrar", dom.errores.length === 0, dom.errores[0]);
  }

  // ── Entrar: credenciales mal, el botón se recupera ──
  {
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true });
    await esperar(400);
    const d = dom.window.document;
    d.getElementById("nube").click();
    await esperar(120);
    d.getElementById("est-accion")?.click();
    await esperar(120);
    const b = d.getElementById("hacer-login");
    if (b){
      d.getElementById("correo").value = "dani@ejemplo";
      d.getElementById("clave").value = "mal";
      b.click();
      await esperar(300);
      comprobar("si la contraseña está mal, se puede reintentar en el acto",
                b.disabled === false, "quedó bloqueado");
      comprobar("y se dice el motivo, no una frase amable",
                /incorrect/i.test(d.getElementById("err-login").textContent),
                `dijo «${d.getElementById("err-login").textContent}»`);
    }
  }

  // ── Salir: el servidor no contesta nunca ──
  {
    const sesion = { user:{ email:"dani@ejemplo" } };
    const falso = supabaseColgado({ salir:"cuelga", sesion });
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true, sesion,
                                      supabasePropio: falso.api });
    await esperar(500);
    const d = dom.window.document;

    const s = d.getElementById("salir");
    comprobar("con sesión, se ofrece salir", !!s, "no está el botón");
    if (s){
      s.click();
      comprobar("mientras sale, el botón se desactiva", s.disabled === true, "admite otro toque");
      s.click();                                // segundo toque
      await esperar(200);
      comprobar("dos toques no lanzan dos cierres de sesión",
                falso.cuentas.salir <= 1, `se llamó ${falso.cuentas.salir} veces`);

      // Y no se queda ahí: el tope lo saca
      await esperar(8400);
      comprobar("con el servidor colgado, salir termina igualmente",
                s.disabled === false, "el botón siguió bloqueado");
      comprobar("y no se queda en «saliendo…» para siempre",
                s.textContent !== "saliendo…", `quedó en «${s.textContent}»`);
    }
    comprobar("la portada no dio errores al salir", dom.errores.length === 0, dom.errores[0]);
  }
}

/* ---- 21. Ninguna garantía que incluya lo que no se puede comprobar ----
   El diario no tiene cola de pendientes: cada gesto hace subir().catch()
   y un fallo no deja rastro. Así que una frase como «a salvo» o «lo ve el
   otro móvil», dicha a secas, estaría prometiendo también por las notas,
   las marcas, las visitas y las pernoctas. No se puede.

   Estas son las frases que no pueden aparecer en ningún sitio visible. */
const GARANTIAS_PROHIBIDAS = [
  /a salvo/i,
  /todo (subido|sincronizado|guardado en la nube)/i,
  /lo ve el otro m[oó]vil(?!\s*(?:los|las))/i,
  /nada pendiente/i,
  /^sincronizado$/i
];

function garantiaDeMas(texto){
  const limpio = String(texto).replace(/\s+/g, " ");
  for (const re of GARANTIAS_PROHIBIDAS){
    const m = limpio.match(re);
    if (m) return m[0];
  }
  return null;
}

async function nadaPrometeDeMas(){
  console.log(`\n${gris("──")} Nada promete por lo que no se puede comprobar`);

  // El caso peligroso: nube conectada y colas vacías, que es cuando
  // apetece decir que está todo bien.
  const sesion = { user:{ email:"dani@ejemplo" } };

  // ── El modelo, directamente ──
  {
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true, sesion });
    await esperar(400);
    const w = dom.window;
    const e = { guarda:true, porSubir:{viajes:0,borrados:0,fotos:0}, total:0, offline:null,
                nube:{ clase:"conectada", txt:"Sincronizado" } };

    const r = w.resumenDeEstado(e);
    comprobar("el resumen verde no promete de más",
              garantiaDeMas(r.txt) === null, `dijo «${r.txt}»`);
    comprobar("y dice exactamente qué cubre",
              /viajes y fotos/i.test(r.txt), `dijo «${r.txt}»`);

    const det = w.detalleEstado(e);
    const sinEtiquetas = det.replace(/<[^>]+>/g, " ");
    comprobar("el detalle tampoco promete de más",
              garantiaDeMas(sinEtiquetas) === null, `apareció «${garantiaDeMas(sinEtiquetas)}»`);
    comprobar("el detalle nombra el diario",
              /Diario/.test(sinEtiquetas), "no aparece el diario");
    comprobar("y explica que de él no se puede confirmar nada",
              /no se puede confirmar si lleg/i.test(sinEtiquetas),
              `decía: ${sinEtiquetas.replace(/\s+/g," ").slice(0,160)}`);
  }

  // ── Y en las cinco apps, con todo pintado ──
  {
    const conViaje = JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"", salida:"",
      dias:[{ t:"Día uno", dest:"Zagreb", paradas:[{ h:"Tarde", txt:"Una parada" }] }] }]);
    const apps = [
      { nombre:"portada",   ruta:"index.html",           url:"https://x/",           abre:"#nube" },
      { nombre:"editor",    ruta:"crear/index.html",     url:"https://x/crear/",     abre:"#est-linea" },
      { nombre:"visor",     ruta:"viaje/index.html",     url:"https://x/viaje/?id=p1",
        info:"info", abre:"#est-linea", almacen:{ viajes_propios: conViaje } },
      { nombre:"Eslovenia", ruta:"eslovenia/index.html", url:"https://x/eslovenia/", info:"info",
        abre:"#est-linea", fecha:"2026-07-25T12:00:00" },
      { nombre:"Asturias",  ruta:"asturias/index.html",  url:"https://x/asturias/",  info:"info",
        abre:"#est-linea" }
    ];

    for (const app of apps){
      const dom = abrir(app.ruta, { url:app.url, almacen:app.almacen || {}, conexion:true, sesion,
                                    ...(app.fecha ? { fecha:app.fecha } : {}) });
      await esperar(450);
      const d = dom.window.document;
      if (app.info){
        [...d.querySelectorAll("nav button")].find(b => b.dataset.v === app.info)?.click();
        await esperar(250);
      }
      d.querySelector(app.abre)?.click();      // abrir el detalle también
      await esperar(150);

      // Lo que se VE, no el código: body.textContent incluye el contenido
      // de los <script>, que aquí van metidos en línea, y estaría leyendo
      // los comentarios del propio sync.js en vez de la pantalla.
      const copia = d.body.cloneNode(true);
      copia.querySelectorAll("script, style, template").forEach(x => x.remove());
      const visible = copia.textContent || "";
      const mal = garantiaDeMas(visible);
      comprobar(`${app.nombre}: nada en pantalla promete por el diario`,
                mal === null, `apareció «${mal}»`);
    }
  }

  // ── Lo que sí debe seguir avisando ──
  {
    const dom = abrir("index.html", { url:"https://x/", almacen:{}, conexion:true, sesion });
    await esperar(400);
    const w = dom.window;
    const base = { guarda:true, offline:null, nube:{ clase:"conectada", txt:"" } };

    let r = w.resumenDeEstado({ ...base, porSubir:{viajes:2,borrados:0,fotos:0}, total:2 });
    comprobar("dos viajes pendientes siguen dando aviso",
              r.nivel === "aviso" && /2 viajes por subir/.test(r.txt), `dijo «${r.txt}»`);

    r = w.resumenDeEstado({ ...base, porSubir:{viajes:0,borrados:0,fotos:5}, total:5 });
    comprobar("cinco fotos pendientes siguen dando aviso",
              r.nivel === "aviso" && /5 fotos por subir/.test(r.txt), `dijo «${r.txt}»`);

    r = w.resumenDeEstado({ ...base, porSubir:{viajes:0,borrados:1,fotos:0}, total:1 });
    comprobar("un borrado pendiente sigue dando aviso",
              r.nivel === "aviso" && /borrado/.test(r.txt), `dijo «${r.txt}»`);
  }
}

/* ---- 22. El motor de búsqueda: presupuesto y cancelación ----
   Antes, una búsqueda podía tener a la persona esperando hasta noventa
   segundos sin poder hacer nada. Ahora hay un plazo desde el toque y se
   puede parar. Los plazos de prueba son de milisegundos: los de verdad
   son de segundos y esperarlos haría la suite inservible. */
/* Una petición que no responde nunca, pero que SÍ rechaza al abortarla,
   igual que hace fetch de verdad. Sin eso el motor se quedaría esperando
   una promesa que no se resuelve jamás, y la prueba también. */
const cuelga = senal => new Promise((_, mal) => {
  if (!senal) return;
  senal.addEventListener("abort", () =>
    mal(Object.assign(new Error("abortada"), { name:"AbortError" })), { once:true });
});

async function elMotorDeBusqueda(){
  console.log(`\n${gris("──")} El motor de búsqueda: plazo y cancelación`);

  // Asturias y sin fecha fija: el banco congela el reloj cuando se le da
  // una, y con Date.now() parado el plazo nunca se agotaría.
  const dom = abrir("asturias/index.html", { url:"https://x/asturias/", almacen:{}, conexion:true });
  await esperar(400);
  const w = dom.window;

  const tresIntentos = [{ ms:5000 }, { ms:5000 }, { ms:5000 }];

  // ── El primero responde: no se prueban los demás ──
  {
    let veces = 0;
    const op = w.abreBusqueda(2000);
    const r = await w.conPresupuesto(op, tresIntentos, async () => {
      veces++; return { listo:true, valor:["algo"] };
    });
    w.cierraBusqueda(op);
    comprobar("si el primer servidor responde, no se prueban los demás",
              r.estado === "bien" && veces === 1, `estado ${r.estado}, ${veces} intentos`);
  }

  // ── El primero falla, responde el segundo ──
  {
    let veces = 0;
    const op = w.abreBusqueda(2000);
    const r = await w.conPresupuesto(op, tresIntentos, async n => {
      veces++;
      return n === 0 ? { motivo:"ocupado" } : { listo:true, valor:["del segundo"] };
    });
    w.cierraBusqueda(op);
    comprobar("si el primero falla, se usa el segundo",
              r.estado === "bien" && r.valor[0] === "del segundo" && veces === 2,
              `estado ${r.estado}, ${veces} intentos`);
  }

  // ── El plazo NO se reinicia al cambiar de servidor ──
  {
    const t0 = Date.now();
    const op = w.abreBusqueda(600);                 // plazo total
    const r = await w.conPresupuesto(op, [{ ms:5000 }, { ms:5000 }, { ms:5000 }], (n, se) => cuelga(se));
    const tardo = Date.now() - t0;
    w.cierraBusqueda(op);
    comprobar("el plazo total manda sobre el tope de cada intento",
              r.estado === "tarde", `estado ${r.estado}`);
    comprobar("y cambiar de servidor NO reinicia el reloj",
              tardo < 1400, `tardó ${tardo} ms con un plazo de 600`);
  }

  // ── Todos cuelgan, pero da tiempo a probarlos: fallaron ──
  {
    let veces = 0;
    const op = w.abreBusqueda(1200);
    const r = await w.conPresupuesto(op, [{ ms:120 }, { ms:120 }, { ms:120 }], (n, se) => { veces++; return cuelga(se); });
    w.cierraBusqueda(op);
    comprobar("con los tres colgados se prueban los tres",
              veces === 3, `${veces} intentos`);
    comprobar("y se dice que fallaron, no que se acabó el tiempo",
              r.estado === "fallaron", `estado ${r.estado}`);
  }

  // ── No se empieza un intento para el que no queda plazo ──
  {
    let veces = 0;
    const op = w.abreBusqueda(500);
    const r = await w.conPresupuesto(op, [{ ms:120 }, { ms:120 }, { ms:120 }], (n, se) => { veces++; return cuelga(se); });
    w.cierraBusqueda(op);
    comprobar("no se empieza un intento sin plazo para terminarlo",
              veces < 3, `se empezaron ${veces}`);
    comprobar("y se dice que se acabó el tiempo", r.estado === "tarde", `estado ${r.estado}`);
  }

  // ── Cancelar durante el primer servidor ──
  {
    let abortada = false;
    const op = w.abreBusqueda(5000);
    const p = w.conPresupuesto(op, tresIntentos, (n, senal) => new Promise((_, mal) => {
      senal.addEventListener("abort", () => { abortada = true; mal(Object.assign(new Error("x"), { name:"AbortError" })); });
    }));
    await esperar(40);
    const t0 = Date.now();
    w.cancelaBusqueda();
    const r = await p;
    comprobar("cancelar durante el primer servidor corta al momento",
              r.estado === "cancelada" && Date.now() - t0 < 400, `estado ${r.estado}`);
    comprobar("y aborta la petición de verdad", abortada === true, "no se llamó a abort()");
  }

  // ── Cancelar durante un servidor alternativo ──
  {
    let intentos = 0, abortada = false;
    const op = w.abreBusqueda(5000);
    const p = w.conPresupuesto(op, tresIntentos, (n, senal) => {
      intentos++;
      if (n === 0) return Promise.resolve({ motivo:"ocupado" });
      return new Promise((_, mal) => senal.addEventListener("abort", () => {
        abortada = true; mal(Object.assign(new Error("x"), { name:"AbortError" }));
      }));
    });
    await esperar(40);
    w.cancelaBusqueda();
    const r = await p;
    comprobar("cancelar en el segundo servidor también corta",
              r.estado === "cancelada", `estado ${r.estado}`);
    comprobar("y aborta el intento en curso", abortada === true, "no se abortó");
    comprobar("sin llegar al tercero", intentos === 2, `${intentos} intentos`);
  }

  // ── Un toque nuevo cancela el anterior: nunca dos en paralelo ──
  {
    let vivos = 0, maximo = 0;
    const pide = (n, senal) => new Promise((_, mal) => {
      vivos++; maximo = Math.max(maximo, vivos);
      senal.addEventListener("abort", () => { vivos--; mal(Object.assign(new Error("x"), { name:"AbortError" })); });
    });
    const op1 = w.abreBusqueda(3000);
    const p1 = w.conPresupuesto(op1, tresIntentos, pide);
    await esperar(30);
    const op2 = w.abreBusqueda(300);                // segundo toque
    const p2 = w.conPresupuesto(op2, [{ ms:100 }], pide);
    const r1 = await p1, r2 = await p2;
    comprobar("un toque nuevo cancela el anterior",
              r1.estado === "cancelada" || r1.estado === "reemplazada", `la vieja quedó ${r1.estado}`);
    comprobar("y nunca hay dos peticiones en vuelo a la vez",
              maximo === 1, `llegó a haber ${maximo}`);
    comprobar("la vieja no puede repintar: su generación ya no vale",
              !op1.viva(), "la vieja seguía viva");
    w.cierraBusqueda(op2);
  }

  // ── Una respuesta que llega tarde no vale ──
  {
    const op = w.abreBusqueda(3000);
    let suelta;
    const p = w.conPresupuesto(op, tresIntentos, () => new Promise(ok => { suelta = ok; }));
    await esperar(30);
    w.abreBusqueda(3000);                            // llega otra búsqueda
    suelta({ listo:true, valor:["tarde"] });         // y AHORA responde la vieja
    const r = await p;
    comprobar("una respuesta que llega tarde se descarta",
              r.estado === "reemplazada", `estado ${r.estado}`);
    w.cancelaBusqueda();
  }
}

/* ---- 23. Buscar desde la pantalla: GPS, cancelar y concurrencia ---- */

/* Deja la app con posición y con los chips de categoría a la vista, que es
   como está cuando alguien va a buscar algo de verdad. */
async function appConBusqueda(opciones = {}){
  const dom = abrir("asturias/index.html",
    { url:"https://x/asturias/", almacen:{}, conexion:true, ...opciones });
  await esperar(400);
  const d = dom.window.document, w = dom.window;

  // Contador de peticiones de posición, y control de cuándo responde
  const gps = { pedidas:0, sueltas:[], responde:true };
  w.navigator.geolocation = { getCurrentPosition: (ok, mal) => {
    gps.pedidas++;
    const dar = () => ok({ coords:{ latitude:43.09, longitude:-6.25 } });
    if (gps.responde) setTimeout(dar, 15); else gps.sueltas.push(dar);
  } };

  [...d.querySelectorAll("nav button")].find(b => b.dataset.v === "guia")?.click();
  await esperar(200);
  const situar = d.getElementById("btn-serv");
  if (situar){ situar.click(); await esperar(200); }
  return { dom, d, w, gps };
}

const respuestaOverpass = { elements: [
  { lat:43.10, lon:-6.26, tags:{ name:"Gasolinera de prueba", amenity:"fuel" } }
] };

async function buscarDesdeLaPantalla(){
  console.log(`\n${gris("──")} Buscar desde la pantalla`);

  // ── «De camino hoy» pide UNA sola posición ──
  {
    const { d, w, gps } = await appConBusqueda();
    let llamadas = 0;
    w.fetch = async () => { llamadas++; return { ok:true, json: async () => respuestaOverpass }; };

    const antes = gps.pedidas;
    const ruta = [...d.querySelectorAll("[data-donde]")].find(b => b.dataset.donde === "ruta");
    if (ruta){ ruta.click(); await esperar(120); }
    const chip = d.querySelector("[data-cat]");
    comprobar("hay chips de categoría para buscar", !!chip, "no aparecieron");
    if (chip){
      chip.click();
      await esperar(700);
      comprobar("«de camino hoy» pide la posición una sola vez",
                gps.pedidas - antes === 1, `la pidió ${gps.pedidas - antes} veces`);
    }
  }

  // ── Cancelar durante el GPS ──
  {
    const { d, w, gps } = await appConBusqueda();
    gps.responde = false;                       // el GPS se queda pensando
    w.fetch = async () => ({ ok:true, json: async () => respuestaOverpass });

    const chip = d.querySelector("[data-cat]");
    chip.click();
    await esperar(120);
    const cancelar = d.getElementById("busca-cancelar");
    comprobar("mientras localiza se ofrece cancelar", !!cancelar, "no está el botón");
    if (cancelar){
      cancelar.click();
      await esperar(120);
      const txt = d.getElementById("res-serv").textContent;
      comprobar("cancelar durante el GPS lo dice, y no como un fallo",
                /cancelada/i.test(txt) && !/no se pudo|fall/i.test(txt), `dijo «${txt.trim().slice(0,80)}»`);

      // Y ahora el GPS contesta tarde: no puede repintar nada
      gps.sueltas.forEach(f => f());
      await esperar(250);
      const despues = d.getElementById("res-serv").textContent;
      comprobar("un GPS que llega tarde no repinta la pantalla",
                /cancelada/i.test(despues), `quedó «${despues.trim().slice(0,80)}»`);
    }
  }

  // ── Cancelar durante Overpass ──
  {
    const { d, w } = await appConBusqueda();
    let abortada = false;
    w.fetch = (u, o) => new Promise((_, mal) => {
      o.signal.addEventListener("abort", () => {
        abortada = true; mal(Object.assign(new Error("x"), { name:"AbortError" }));
      });
    });
    const chip = d.querySelector("[data-cat]");
    chip.click();
    await esperar(200);
    const cancelar = d.getElementById("busca-cancelar");
    comprobar("mientras busca se ofrece cancelar", !!cancelar, "no está el botón");
    if (cancelar){
      const t0 = Date.now();
      cancelar.click();
      await esperar(150);
      comprobar("cancelar durante la búsqueda aborta la petición", abortada === true, "no se abortó");
      comprobar("y corta al momento, sin esperar al plazo",
                Date.now() - t0 < 800, `tardó ${Date.now() - t0} ms`);
      const txt = d.getElementById("res-serv").textContent;
      comprobar("y lo dice sin llamarlo error",
                /cancelada/i.test(txt), `dijo «${txt.trim().slice(0,80)}»`);
    }
    comprobar("sin errores de JavaScript al cancelar",
              (await appConBusqueda()).dom.errores.length === 0, "hubo errores");
  }

  // ── Dos toques seguidos: manda el último y el viejo no repinta ──
  {
    const { d, w } = await appConBusqueda();
    let peticiones = 0;
    w.fetch = async (u) => {
      peticiones++;
      const mio = peticiones;
      await new Promise(r => setTimeout(r, mio === 1 ? 300 : 20));   // el primero, lento
      return { ok:true, json: async () => ({ elements: [
        { lat:43.10, lon:-6.26, tags:{ name: mio === 1 ? "VIEJO" : "NUEVO", amenity:"fuel" } }
      ] }) };
    };

    const chips = [...d.querySelectorAll("[data-cat]")];
    chips[0].click();
    await esperar(60);
    chips[1].click();                       // segundo toque antes de que llegue el primero
    await esperar(700);

    const txt = d.getElementById("res-serv").textContent;
    comprobar("manda el último toque, no el primero",
              /NUEVO/.test(txt) && !/VIEJO/.test(txt), `quedó «${txt.trim().slice(0,90)}»`);
    comprobar("y el primero no repinta cuando llega tarde",
              !/VIEJO/.test(d.getElementById("res-serv").textContent), "repintó el viejo");
  }

  // ── Sin cobertura se dice enseguida ──
  {
    const { d, w } = await appConBusqueda({ conexion:false });
    w.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    const chip = d.querySelector("[data-cat]");
    if (chip){
      const t0 = Date.now();
      chip.click();
      await esperar(500);
      comprobar("sin cobertura se responde enseguida",
                Date.now() - t0 < 1500, `tardó ${Date.now() - t0} ms`);
      comprobar("y se dice que es por cobertura",
                /cobertura|conexi[oó]n/i.test(d.getElementById("res-serv").textContent),
                `dijo «${d.getElementById("res-serv").textContent.trim().slice(0,80)}»`);
    }
  }

  // ── Respuesta vacía de verdad: no es un fallo ──
  {
    const { d, w } = await appConBusqueda();
    w.fetch = async () => ({ ok:true, json: async () => ({ elements: [] }) });
    const chip = d.querySelector("[data-cat]");
    chip.click();
    await esperar(500);
    const txt = d.getElementById("res-serv").textContent;
    comprobar("si no hay nada, se dice sin llamarlo fallo",
              /Nada en/i.test(txt) && !/no se pudo|no responden|cancelada/i.test(txt),
              `dijo «${txt.trim().slice(0,80)}»`);
  }

  // ── El visor, con su único servidor colgado ──
  {
    const conViaje = JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"", salida:"",
      dias:[{ t:"Día uno", dest:"Zagreb", xy:"45.81,15.98",
              paradas:[{ h:"Tarde", txt:"Una parada", xy:"45.81,15.98" }] }] }]);
    const dom = abrir("viaje/index.html", { url:"https://x/viaje/?id=p1",
      almacen:{ viajes_propios: conViaje }, conexion:true, posicion:[45.81, 15.98] });
    await esperar(400);
    const d = dom.window.document, w = dom.window;

    let abortada = false;
    w.fetch = (u, o) => new Promise((_, mal) => {
      o.signal.addEventListener("abort", () => {
        abortada = true; mal(Object.assign(new Error("x"), { name:"AbortError" }));
      });
    });

    [...d.querySelectorAll("nav button")].find(b => b.dataset.v === "cerca")?.click();
    await esperar(250);
    // En el visor el botón se llama «dar-pos», y hasta que no hay posición
    // no se pintan los chips de categoría.
    const situar = d.getElementById("dar-pos");
    comprobar("el visor pide la ubicación antes de buscar", !!situar, "no está el botón");
    if (situar){ situar.click(); await esperar(400); }

    const chip = d.querySelector("[data-cat]");
    comprobar("el visor ofrece buscar", !!chip, "no hay chips");
    if (chip){
      chip.click();
      await esperar(200);
      const cancelar = d.getElementById("busca-cancelar");
      comprobar("el visor también deja cancelar, con su único servidor",
                !!cancelar, "no está el botón");
      if (cancelar){
        cancelar.click();
        await esperar(150);
        comprobar("y aborta su petición de verdad", abortada === true, "no se abortó");
        comprobar("y lo dice sin llamarlo error",
                  /cancelada/i.test(d.getElementById("res-cerca").textContent),
                  `dijo «${d.getElementById("res-cerca").textContent.trim().slice(0,80)}»`);
      }
    }
    comprobar("el visor no dio errores al cancelar", dom.errores.length === 0, dom.errores[0]);
  }

  // ── Cancelar mientras se calculan los tiempos por carretera ──
  {
    const { d, w } = await appConBusqueda();
    let osrmAbortada = false;
    w.fetch = (u, o) => {
      if (String(u).includes("router.project-osrm.org"))
        return new Promise((_, mal) => o.signal.addEventListener("abort", () => {
          osrmAbortada = true; mal(Object.assign(new Error("x"), { name:"AbortError" }));
        }));
      return Promise.resolve({ ok:true, json: async () => respuestaOverpass });
    };
    const chip = d.querySelector("[data-cat]");
    chip.click();
    await esperar(400);
    const conResultados = d.getElementById("res-serv").textContent;
    comprobar("los resultados se pintan antes de calcular los tiempos",
              /Gasolinera de prueba/.test(conResultados), `quedó «${conResultados.trim().slice(0,80)}»`);

    w.cancelaBusqueda();
    await esperar(200);
    comprobar("cancelar durante los tiempos por carretera los aborta",
              osrmAbortada === true, "no se abortó OSRM");
    const despues = d.getElementById("res-serv").textContent;
    comprobar("y los resultados que ya estaban NO se borran",
              /Gasolinera de prueba/.test(despues), `quedó «${despues.trim().slice(0,80)}»`);
    comprobar("ni se sustituyen por un mensaje de cancelación",
              !/cancelada/i.test(despues), `quedó «${despues.trim().slice(0,80)}»`);
  }

  // ── Los resultados sobreviven a que OSRM falle después ──
  {
    const { d, w } = await appConBusqueda();
    w.fetch = async (u) => {
      if (String(u).includes("router.project-osrm.org")) throw new Error("OSRM caído");
      return { ok:true, json: async () => respuestaOverpass };
    };
    const chip = d.querySelector("[data-cat]");
    chip.click();
    await esperar(700);
    const txt = d.getElementById("res-serv").textContent;
    comprobar("si los tiempos por carretera fallan, los resultados siguen ahí",
              /Gasolinera de prueba/.test(txt), `quedó «${txt.trim().slice(0,90)}»`);
    comprobar("y no se sustituyen por un mensaje de error",
              !/no se pudo|no responden/i.test(txt), `quedó «${txt.trim().slice(0,90)}»`);
    comprobar("se explica que las distancias son en línea recta",
              /l[ií]nea recta/i.test(txt), `quedó «${txt.trim().slice(0,120)}»`);
  }
}

/* ---- 24. Cámara y documentos: una tanda cada vez ----
   Comprimir y guardar una foto tarda. Dos selecciones seguidas metían dos
   tandas a la vez y guardaban lo mismo dos veces. */

/* Le pone archivos de mentira a un <input type=file> y dispara el evento,
   que es lo que hace el navegador cuando alguien elige algo. */
function eligeArchivos(d, inp, nombres){
  Object.defineProperty(inp, "files", {
    value: nombres.map(n => ({ name:n, type:"image/jpeg", size:1000 })),
    configurable: true
  });
  inp.dispatchEvent(new d.defaultView.Event("change", { bubbles:true }));
}

async function unaTandaCadaVez(){
  console.log(`\n${gris("──")} Cámara y documentos: una tanda cada vez`);

  const abreConFotos = async pestana => {
    const dom = abrir("eslovenia/index.html", { url:"https://x/eslovenia/", almacen:{},
      conexion:false, fecha:"2026-07-25T12:00:00", conFotos:true });
    await esperar(500);
    const d = dom.window.document;
    if (pestana){
      [...d.querySelectorAll("nav button")].find(b => b.dataset.v === pestana)?.click();
      await esperar(300);
    }
    return { dom, d, w:dom.window };
  };

  /* Cuenta cuántas veces se empieza a procesar un archivo: es la operación
     lanzada, no el resultado. Dos tandas a la vez pueden acabar guardando
     lo mismo y parecer una sola si solo se miran las fotos guardadas. */
  const cuentaLecturas = w => {
    const cuenta = { veces:0, falla:false };
    w.FileReader = class {
      readAsDataURL(){
        cuenta.veces++;
        setTimeout(() => {
          if (cuenta.falla) { this.onerror && this.onerror(); return; }
          this.result = "x"; this.onload && this.onload();
        }, 40);
      }
    };
    return cuenta;
  };

  // ═══ CÁMARA ═══
  {
    const { dom, d, w } = await abreConFotos(null);
    const inp = d.querySelector("[data-carrete]");
    comprobar("la cámara tiene su selector de archivos", !!inp, "no está");
    if (inp){
      const cuenta = cuentaLecturas(w);
      const etiqueta = inp.parentElement;

      eligeArchivos(d, inp, ["una.jpg"]);
      await esperar(10);
      comprobar("mientras procesa, el control se marca ocupado",
                etiqueta.getAttribute("aria-busy") === "true", "sin aria-busy");

      eligeArchivos(d, inp, ["otra.jpg"]);      // segunda selección, a propósito
      await esperar(20);
      comprobar("dos selecciones seguidas no lanzan dos tandas",
                cuenta.veces === 1, `se procesaron ${cuenta.veces} archivos`);

      await esperar(400);
      comprobar("al terminar, el control queda libre",
                !etiqueta.hasAttribute("aria-busy"), "siguió ocupado");
      comprobar("y el selector se vacía para poder elegir otra vez",
                inp.value === "", `quedó «${inp.value}»`);

      // Y después se puede procesar otra distinta
      cuenta.veces = 0;
      eligeArchivos(d, inp, ["tercera.jpg"]);
      await esperar(400);
      comprobar("después se puede procesar otra foto",
                cuenta.veces === 1, `se procesaron ${cuenta.veces}`);
    }
    comprobar("la cámara no dio errores", dom.errores.length === 0, dom.errores[0]);
  }

  // ── Recuperación tras un fallo ──
  {
    const { d, w } = await abreConFotos(null);
    const inp = d.querySelector("[data-carrete]");
    if (inp){
      const cuenta = cuentaLecturas(w);
      cuenta.falla = true;                       // comprimir va a fallar
      const etiqueta = inp.parentElement;
      const antes = etiqueta.querySelector("span").textContent;

      eligeArchivos(d, inp, ["rota.jpg"]);
      await esperar(400);
      comprobar("si falla, el control vuelve a quedar libre",
                !etiqueta.hasAttribute("aria-busy"), "siguió ocupado");
      comprobar("y la etiqueta recupera su texto",
                etiqueta.querySelector("span").textContent === antes,
                `quedó «${etiqueta.querySelector("span").textContent}»`);

      cuenta.falla = false; cuenta.veces = 0;
      eligeArchivos(d, inp, ["buena.jpg"]);
      await esperar(400);
      comprobar("y después del fallo se puede volver a intentar",
                cuenta.veces === 1, `se procesaron ${cuenta.veces}`);
    }
  }

  // ── Cancelar el selector no bloquea nada ──
  {
    const { d, w } = await abreConFotos(null);
    const inp = d.querySelector("[data-carrete]");
    if (inp){
      const cuenta = cuentaLecturas(w);
      eligeArchivos(d, inp, []);                 // el selector se cerró sin elegir
      await esperar(60);
      comprobar("cancelar el selector no procesa nada",
                cuenta.veces === 0, `se procesaron ${cuenta.veces}`);
      eligeArchivos(d, inp, ["ahora-si.jpg"]);
      await esperar(400);
      comprobar("y no deja el control bloqueado",
                cuenta.veces === 1, `se procesaron ${cuenta.veces}`);
    }
  }

  // ═══ DOCUMENTOS ═══
  {
    const { dom, d, w } = await abreConFotos("reservas");
    const inp = d.querySelector("[data-doc]");
    comprobar("las tarjetas de embarque tienen su selector", !!inp, "no está");
    if (inp){
      const cuenta = cuentaLecturas(w);
      const etiqueta = inp.parentElement;

      eligeArchivos(d, inp, ["tarjeta.jpg"]);
      await esperar(10);
      comprobar("mientras guarda el documento, el control se marca ocupado",
                etiqueta.getAttribute("aria-busy") === "true", "sin aria-busy");

      eligeArchivos(d, inp, ["otra-tarjeta.jpg"]);
      await esperar(20);
      comprobar("dos selecciones no guardan el documento dos veces",
                cuenta.veces === 1, `se procesaron ${cuenta.veces}`);

      await esperar(400);
      comprobar("al terminar, el control de documentos queda libre",
                !etiqueta.hasAttribute("aria-busy"), "siguió ocupado");

      cuenta.veces = 0;
      eligeArchivos(d, inp, ["tercera-tarjeta.jpg"]);
      await esperar(400);
      comprobar("después se puede guardar otro documento",
                cuenta.veces === 1, `se procesaron ${cuenta.veces}`);
    }
    comprobar("los documentos no dieron errores", dom.errores.length === 0, dom.errores[0]);
  }

  // ── Documentos: recuperación tras fallo ──
  {
    const { d, w } = await abreConFotos("reservas");
    const inp = d.querySelector("[data-doc]");
    if (inp){
      const cuenta = cuentaLecturas(w);
      cuenta.falla = true;
      const etiqueta = inp.parentElement;
      const antes = etiqueta.querySelector("span").textContent;

      eligeArchivos(d, inp, ["rota.jpg"]);
      await esperar(400);
      comprobar("si falla el documento, el control vuelve a quedar libre",
                !etiqueta.hasAttribute("aria-busy"), "siguió ocupado");
      comprobar("y la etiqueta recupera su texto",
                etiqueta.querySelector("span").textContent === antes,
                `quedó «${etiqueta.querySelector("span").textContent}»`);

      cuenta.falla = false; cuenta.veces = 0;
      eligeArchivos(d, inp, ["buena.jpg"]);
      await esperar(400);
      comprobar("y después se puede volver a intentar",
                cuenta.veces === 1, `se procesaron ${cuenta.veces}`);
    }
  }
}

/* ═══ El modo conducción ═══
   Lo importante aquí no es que pinte, es lo que NO hace: no pide GPS,
   no escribe en el diario y no se inventa un destino para una parada
   que no tiene ubicación. */

const CONDUCE_APPS = [
  { nombre:"Eslovenia", ruta:"eslovenia/index.html", url:"https://x/eslovenia/",
    viaje:"eslovenia", opciones:{ fecha:"2026-07-25T12:00:00" } },
  { nombre:"Asturias",  ruta:"asturias/index.html",  url:"https://x/asturias/",
    viaje:"asturias",  opciones:{} },
  { nombre:"visor",     ruta:"viaje/index.html",     url:"https://x/viaje/?id=p1",
    viaje:"p1", opciones:{} }
];

const VIAJE_CONDUCE = JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"",
  dias:[{ t:"Día uno", dest:"Zagreb", paradas:[
    { h:"Mañana", txt:"Primera parada", n:"Con nota", mapa:"Zagreb" },
    { txt:"Segunda sin sitio" },
    { h:"Tarde", txt:"Tercera parada", mapa:"Split" }
  ] }] }]);

/* Abre una app en Hoy con el diario que se le diga */
async function abreConduccion(app, almacen = {}){
  if (app.viaje === "p1") almacen.viajes_propios = almacen.viajes_propios || VIAJE_CONDUCE;
  const dom = abrir(app.ruta, { url:app.url, almacen, ...app.opciones });
  await esperar(700);
  return { dom, d:dom.window.document, w:dom.window, almacen };
}

const textoPanel = d => {
  const v = d.querySelector(".conduce");
  return v ? v.querySelector("h1").textContent.trim() : null;
};

/* Marca paradas como hechas dejándolo escrito donde lo lee el diario */
const diarioCon = (viaje, ...claves) => ({
  ["diario_" + viaje]: JSON.stringify({
    hechas: Object.fromEntries(claves.map(c => [c, 1])), desmarcadas:{}, notas:{} })
});

async function elModoConduccion(){
  console.log(`\n${gris("──")} Modo conducción`);

  /* ---- 1 · Está en Hoy, abre, y sale ---- */
  for (const app of CONDUCE_APPS){
    const { dom, d, w } = await abreConduccion(app);
    const boton = d.getElementById("abrir-conduccion");
    comprobar(`${app.nombre}: el botón «Modo conducción» está en Hoy`,
              !!boton && d.getElementById("v-hoy").contains(boton));
    if (!boton) continue;

    boton.click();
    const v = d.querySelector(".conduce");
    comprobar(`${app.nombre}: al abrirlo aparece la pantalla de conducción`, !!v);
    comprobar(`${app.nombre}: enseña una parada, no una pantalla vacía`,
              !!v && (v.querySelector("h1").textContent.trim().length > 2));
    comprobar(`${app.nombre}: el foco entra en la pantalla`,
              d.activeElement === v, d.activeElement && d.activeElement.tagName);

    // Escape cierra y devuelve el foco al botón de entrada
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key:"Escape" }));
    comprobar(`${app.nombre}: Escape cierra el modo conducción`,
              !d.querySelector(".conduce"));
    comprobar(`${app.nombre}: al salir se vuelve a la vista normal`,
              d.getElementById("v-hoy").innerHTML.trim().length > 40);
    comprobar(`${app.nombre}: y el foco vuelve al botón de entrada`,
              d.activeElement === d.getElementById("abrir-conduccion"),
              d.activeElement && d.activeElement.id);

    // Y también con el botón de salir
    d.getElementById("abrir-conduccion").click();
    d.getElementById("cd-salir").click();
    comprobar(`${app.nombre}: «Salir del modo conducción» también cierra`,
              !d.querySelector(".conduce"));

    comprobar(`${app.nombre}: usarlo no deja errores de JavaScript`,
              dom.errores.length === 0, dom.errores[0]);
  }

  /* ---- 2 · Empieza en la primera parada pendiente ---- */
  {
    const app = CONDUCE_APPS[0];
    const primera = await abreConduccion(app);
    const i = primera.w.eval("indiceHoy()");

    primera.d.getElementById("abrir-conduccion").click();
    comprobar("con el diario vacío empieza por la primera parada",
              textoPanel(primera.d) === "Cascada de Peričnik", textoPanel(primera.d));

    // Con las dos primeras hechas, tiene que saltar a la tercera
    const saltando = await abreConduccion(app, diarioCon(app.viaje, `${i}:0`, `${i}:1`));
    saltando.d.getElementById("abrir-conduccion").click();
    comprobar("las paradas ya hechas se omiten",
              textoPanel(saltando.d) === "Centro histórico", textoPanel(saltando.d));

    // Si el diario no se puede consultar, no vale suponer «ninguna hecha»:
    // hay que empezar por la primera.
    const aCiegas = await abreConduccion(app, diarioCon(app.viaje, `${i}:0`, `${i}:1`));
    aCiegas.w.eval('DIARIO.esta = () => { throw new Error("diario ilegible"); };');
    aCiegas.d.getElementById("abrir-conduccion").click();
    comprobar("sin diario disponible empieza por la primera parada",
              textoPanel(aCiegas.d) === "Cascada de Peričnik", textoPanel(aCiegas.d));
    comprobar("y aun así el modo conducción funciona",
              !!aCiegas.d.querySelector("#cd-salir"));

    // Todas hechas: no queda nada por hacer hoy
    const todas = await abreConduccion(app,
      diarioCon(app.viaje, ...[0,1,2,3,4,5].map(k => `${i}:${k}`)));
    todas.d.getElementById("abrir-conduccion").click();
    comprobar("con todas las paradas hechas avisa de que no queda ninguna",
              textoPanel(todas.d) === "No quedan más paradas para hoy", textoPanel(todas.d));
  }

  /* ---- 3 · «Siguiente» avanza sin tocar nada ---- */
  {
    const app = CONDUCE_APPS[0];
    const { d, w, almacen, dom } = await abreConduccion(app);
    d.getElementById("abrir-conduccion").click();

    const antes = JSON.stringify(almacen);
    const orden = [textoPanel(d)];
    for (let k = 0; k < 6; k++){
      const sig = d.getElementById("cd-sig");
      if (!sig) break;
      sig.click();
      orden.push(textoPanel(d));
    }

    comprobar("«Siguiente» recorre las paradas en el orden del día, sin reordenar",
              orden.slice(0, 6).join(" | ") ===
              ["Cascada de Peričnik","Bajada a Liubliana","Centro histórico",
               "Castillo de Liubliana","Cena en las terrazas del río",
               "Check-in en Pr Ambružarju"].join(" | "), orden.join(" | "));
    comprobar("al llegar al final dice que no quedan más paradas",
              orden[orden.length - 1] === "No quedan más paradas para hoy",
              orden[orden.length - 1]);
    comprobar("en el final ya no se ofrece «Siguiente»",
              !d.getElementById("cd-sig"));
    comprobar("«Siguiente» no escribe nada en el almacenamiento",
              JSON.stringify(almacen) === antes, "cambió el almacén");
    comprobar("y no marca ninguna parada como hecha",
              w.eval(`DIARIO.esta("${w.eval("indiceHoy()")}:0")`) === false);
    comprobar("recorrerlo entero no deja errores", dom.errores.length === 0, dom.errores[0]);
  }

  /* ---- 4 · Con ubicación y sin ella ---- */
  {
    const app = CONDUCE_APPS[0];
    const { d, w } = await abreConduccion(app);
    d.getElementById("abrir-conduccion").click();

    const ir = d.querySelector(".conduce .cd-ir");
    // El aparcamiento va por delante del sitio: es el destino real de esa
    // parada en los datos, el mismo que ya usan los chips de ruta.
    comprobar("«Ir» lleva al destino real de la parada",
              !!ir && ir.getAttribute("href") === w.eval('navegar("Koča pri Peričniku")'),
              ir && ir.getAttribute("href"));
    comprobar("«Ir» dice a dónde va y con qué aplicación",
              !!ir && /Ir a Koča pri Peričniku con (Waze|Maps)/.test(ir.getAttribute("aria-label")),
              ir && ir.getAttribute("aria-label"));

    d.getElementById("cd-sig").click();
    const panel = d.querySelector(".conduce");
    comprobar("una parada sin ubicación lo dice",
              /Esta parada no tiene ubicación/.test(panel.textContent));
    comprobar("y no se inventa ninguna navegación para ella",
              panel.querySelectorAll("a[href]").length === 0,
              [...panel.querySelectorAll("a[href]")].map(a => a.getAttribute("href")).join(" "));
    comprobar("pero la parada se sigue viendo",
              textoPanel(d) === "Bajada a Liubliana", textoPanel(d));
  }

  /* ---- 5 · Ni GPS ni cobertura ---- */
  {
    const app = CONDUCE_APPS[1];
    const { d, w, dom } = await abreConduccion(
      { ...app, opciones:{ ...app.opciones, conexion:false, posicion:[43.1, -6.2] } });

    // El contador se pone después de cargar: lo que se vigila es el modo
    // conducción, no lo que la app haga al arrancar.
    let peticiones = 0;
    w.navigator.geolocation = { getCurrentPosition(){ peticiones++; },
                                watchPosition(){ peticiones++; return 1; } };

    d.getElementById("abrir-conduccion").click();
    const v = d.querySelector(".conduce");
    comprobar("sin cobertura el modo conducción abre igual", !!v);
    comprobar("y enseña la parada", textoPanel(d) === "San Miguel → Villablino → Puerto de Somiedo",
              textoPanel(d));
    const ir = v.querySelector(".cd-ir");
    comprobar("sin cobertura «Ir» sigue teniendo un enlace de navegación válido",
              !!ir && /^(https:|waze:)/.test(ir.getAttribute("href")),
              ir && ir.getAttribute("href"));

    d.getElementById("cd-sig").click();
    d.getElementById("cd-sig").click();
    comprobar("el modo conducción no pide la ubicación en ningún momento",
              peticiones === 0, `la pidió ${peticiones} vez/veces`);
    comprobar("sin cobertura tampoco hay errores", dom.errores.length === 0, dom.errores[0]);
  }

  /* ---- 6 · El visor: sus propios datos ---- */
  {
    const app = CONDUCE_APPS[2];
    const { d, w } = await abreConduccion(app);
    d.getElementById("abrir-conduccion").click();
    const ir = d.querySelector(".conduce .cd-ir");
    comprobar("visor: «Ir» usa el destino escrito en el viaje",
              !!ir && ir.getAttribute("href") === w.eval('navegar("Zagreb")'),
              ir && ir.getAttribute("href"));
    comprobar("visor: enseña la nota de la parada",
              /Con nota/.test(d.querySelector(".conduce").textContent));

    d.getElementById("cd-sig").click();
    comprobar("visor: la parada sin sitio no genera navegación",
              d.querySelectorAll(".conduce a[href]").length === 0 &&
              /Esta parada no tiene ubicación/.test(d.querySelector(".conduce").textContent));
  }

  /* ---- 7 · Los dos temas ---- */
  {
    const app = CONDUCE_APPS[0];
    const lee = async tema => {
      const { d } = await abreConduccion(app, { tema_viajes: tema });
      d.getElementById("abrir-conduccion").click();
      return d.querySelector(".conduce").textContent.replace(/\s+/g, " ").trim();
    };
    const oscuro = await lee("oscuro"), claro = await lee("claro");
    comprobar("el modo conducción enseña lo mismo en claro y en oscuro",
              oscuro === claro && oscuro.length > 30);

    // Un color escrito a mano en el CSS sería invisible en uno de los dos
    // temas: por eso todo va con variables.
    for (const a of CONDUCE_APPS){
      const bloque = fs.readFileSync(path.join(RAIZ, a.ruta), "utf8")
        .match(/\.conduce\{[\s\S]*?\.conduce \.cd-sin\{[^}]*\}/);
      comprobar(`${a.nombre}: el modo conducción no escribe colores a mano`,
                !!bloque && !/#[0-9a-fA-F]{3,8}\b/.test(bloque[0]),
                bloque && (bloque[0].match(/#[0-9a-fA-F]{3,8}\b/) || [""])[0]);
    }
  }
}

/* ═══ Copia de seguridad ═══
   Lo que se prueba aquí no es que el archivo se genere, es que un
   archivo malo no toque ni un dato, y que uno bueno no pise lo que ya
   hay en el móvil. */

const FOTO_A = { id:"p1:0:111aaaa", viaje:"p1", dia:0, datos:"data:image/jpeg;base64,AAAA",
                 xy:"43.1,-6.2", cuando:111 };
const DOC_A  = { id:"doc:p1:tarjeta:zz9", viaje:"p1", dia:-1, doc:"tarjeta",
                 nombre:"Vuelo ida", datos:"data:image/jpeg;base64,BBBB", cuando:222 };

const VIAJE_A = { id:"p1", nombre:"Eslovenia a medida", desde:"2026-07-18", hasta:"2026-07-28",
                  actualizado:"2026-08-01T10:00:00.000Z",
                  dias:[{ t:"Día uno", dest:"Bled", paradas:[{ txt:"Una parada", mapa:"Bled" }] }] };

const DIARIO_A = { hechas:{ "0:0":1000 }, desmarcadas:{}, notas:{ "0":{ t:"Qué día", ts:1000 } },
                   posiciones:{}, visitas:[{ id:"v1", dia:0, xy:"46,14", ts:900, txt:"Aquí" }],
                   pernoctas:[], portadas:{} };

/* Un móvil con datos de todos los tipos del inventario */
function almacenLleno(){
  return {
    viajes_propios: JSON.stringify([VIAJE_A]),
    viajes_pendientes: JSON.stringify(["p1"]),
    viajes_borrados: JSON.stringify(["fantasma"]),
    fotos_pendientes: JSON.stringify([FOTO_A.id]),
    diario_p1: JSON.stringify(DIARIO_A),
    diario_eslovenia: JSON.stringify({ hechas:{ "7:0":500 }, desmarcadas:{}, notas:{} }),
    ast_salida: "2026-09-01",
    tema_viajes: "oscuro",
    nav_app: "maps",
    // Lo que NO puede salir en la copia
    "sb-cmkzcvfjgrgxwqjimtxa-auth-token": JSON.stringify({ access_token:"TOKEN-SECRETO-123" }),
    eslovenia26_pw: "la-contrasena-de-eslovenia",
    traspaso_viaje: JSON.stringify({ vale:"x", id:"p1", viaje:VIAJE_A }),
    traspaso_ok: "1"
  };
}

/* Abre la portada con IndexedDB de verdad y le mete las fotos que se le digan */
async function abrePortada(almacen, fotos = [], extra = {}){
  const dom = abrir("index.html", { url:"https://x/", almacen, conFotos:true, ...extra });
  await esperar(500);
  const w = dom.window;
  if (fotos.length) await w.eval(`FOTOS.meterVarias(${JSON.stringify(fotos)})`);
  return { dom, w, d:w.document, almacen };
}

const fotosDe = w => w.eval("FOTOS.todas()");

async function laCopiaDeSeguridad(){
  console.log(`\n${gris("──")} Copia de seguridad`);

  /* ---- 1 · La sección está en la portada ---- */
  {
    const { d, dom } = await abrePortada({});
    const zona = [...d.querySelectorAll(".mantenimiento")]
      .find(z => /Copia de seguridad/.test(z.textContent));
    comprobar("la portada tiene una sección «Copia de seguridad»", !!zona);
    comprobar("con botón para descargar", !!d.getElementById("btn-copia"));
    comprobar("y botón para restaurar", !!d.getElementById("btn-restaurar"));
    comprobar("la portada sigue cargando sin errores", dom.errores.length === 0, dom.errores[0]);
  }

  /* ---- 2 · Lo que lleva la copia ---- */
  {
    const { w } = await abrePortada(almacenLleno(), [FOTO_A, DOC_A], { conexion:false });
    const r = await w.eval("copiaCompleta()");
    comprobar("sin cobertura la copia se hace igual", !r.error && !!r.copia, r.error);
    const c = r.copia;

    comprobar("la copia dice a qué app pertenece",
              c.app === "viajes.dtabuyodesigner", c.app);
    comprobar("y lleva versión de formato y fecha",
              c.formato === 1 && /^\d{4}-\d{2}-\d{2}T/.test(c.creada || ""),
              `${c.formato} · ${c.creada}`);

    const debe = ["viajes_propios","viajes_pendientes","viajes_borrados","fotos_pendientes",
                  "diario_p1","diario_eslovenia","ast_salida","tema_viajes","nav_app"];
    const faltan = debe.filter(k => !(k in c.local));
    comprobar("la copia lleva todos los tipos de datos del inventario",
              faltan.length === 0, "faltan: " + faltan.join(", "));

    comprobar("lleva las fotos y los documentos",
              c.fotos.length === 2 &&
              c.fotos.some(f => f.id === FOTO_A.id) && c.fotos.some(f => f.id === DOC_A.id),
              `${c.fotos.length} elementos`);

    // Nada de credenciales
    const prohibidas = ["sb-cmkzcvfjgrgxwqjimtxa-auth-token","eslovenia26_pw",
                        "traspaso_viaje","traspaso_ok"];
    const coladas = prohibidas.filter(k => k in c.local);
    comprobar("no se lleva la sesión, la contraseña ni el traspaso",
              coladas.length === 0, "se coló: " + coladas.join(", "));
    const texto = JSON.stringify(c);
    comprobar("y el archivo no contiene el token ni la contraseña en ningún sitio",
              !texto.includes("TOKEN-SECRETO-123") && !texto.includes("la-contrasena-de-eslovenia"));

    const n = w.eval(`resumenDeCopia(${JSON.stringify(c)})`);
    comprobar("el resumen cuenta lo que hay de verdad",
              n.viajes === 1 && n.fotos === 1 && n.documentos === 1 && n.diario === 4,
              JSON.stringify(n));
    comprobar("el nombre del archivo lleva la fecha",
              w.eval(`nombreDeCopia(${JSON.stringify(c)})`) ===
              `viajes-copia-${c.creada.slice(0,10)}.json`);
  }

  /* ---- 3 · Un archivo malo no toca nada ---- */
  {
    // Los rechazos se prueban con una carga que SÍ haría daño si pasara:
    // un archivo inofensivo podría dar verde aunque la comprobación no
    // existiera, porque no habría nada que ver cambiar.
    const DANINO = {
      local:{ viajes_propios: JSON.stringify([{ id:"intruso", nombre:"Intruso", dias:[] }]),
              gen_app:"maps" },
      fotos:[{ id:"intruso:0:1", viaje:"intruso", dia:0,
               datos:"data:image/jpeg;base64,ZZZZ", cuando:1 }]
    };

    const malos = [
      ["un archivo que no es JSON", "esto no es json {{{"],
      ["un archivo vacío", "   "],
      ["un JSON que no es un objeto", "[1,2,3]"],
      ["una copia de otra aplicación", JSON.stringify({ app:"otra.cosa", formato:1, ...DANINO })],
      ["una copia sin identidad", JSON.stringify({ formato:1, ...DANINO })],
      ["una copia de otro formato", JSON.stringify({ app:"viajes.dtabuyodesigner", formato:9, ...DANINO })],
      ["una copia sin el bloque de datos", JSON.stringify({ app:"viajes.dtabuyodesigner", formato:1, fotos:[] })],
      ["una copia sin la lista de fotos", JSON.stringify({ app:"viajes.dtabuyodesigner", formato:1, local:{} })],
      ["una copia con una foto sin contenido", JSON.stringify({ app:"viajes.dtabuyodesigner", formato:1,
        local:{}, fotos:[{ id:"x" }] })],
      ["una copia con un viaje sin identificador", JSON.stringify({ app:"viajes.dtabuyodesigner", formato:1,
        local:{ viajes_propios: JSON.stringify([{ nombre:"Sin id" }]) }, fotos:[] })],
      ["una copia con un bloque corrupto", JSON.stringify({ app:"viajes.dtabuyodesigner", formato:1,
        local:{ viajes_propios: 42 }, fotos:[] })]
    ];

    for (const [que, texto] of malos){
      const { w, almacen } = await abrePortada(almacenLleno(), [FOTO_A, DOC_A]);
      const antes = JSON.stringify(almacen);
      const fotosAntes = JSON.stringify(await fotosDe(w));

      const res = await w.eval(`restauraCopia(${JSON.stringify(texto)})`);
      comprobar(`se rechaza ${que}`, res.ok === false && !!res.motivo, JSON.stringify(res));
      comprobar(`  …y no cambia ni un dato guardado`,
                JSON.stringify(almacen) === antes &&
                JSON.stringify(await fotosDe(w)) === fotosAntes,
                "algún almacén cambió");
    }
  }

  /* ---- 4 · Exportar y volver a poner en otro móvil ---- */
  {
    const origen = await abrePortada(almacenLleno(), [FOTO_A, DOC_A]);
    const texto = JSON.stringify((await origen.w.eval("copiaCompleta()")).copia);

    const destino = await abrePortada({}, []);
    const res = await destino.w.eval(`restauraCopia(${JSON.stringify(texto)})`);
    comprobar("una copia exportada se puede restaurar en un móvil vacío", res.ok === true,
              res.motivo);

    const viajes = JSON.parse(destino.almacen.viajes_propios || "[]");
    comprobar("vuelve el viaje", viajes.length === 1 && viajes[0].id === "p1");
    const diario = JSON.parse(destino.almacen.diario_p1 || "{}");
    comprobar("vuelve el diario con sus marcas, notas y visitas",
              diario.hechas["0:0"] === 1000 && diario.notas["0"].t === "Qué día" &&
              diario.visitas.length === 1);
    comprobar("vuelven las operaciones pendientes",
              JSON.parse(destino.almacen.viajes_pendientes || "[]").includes("p1") &&
              JSON.parse(destino.almacen.fotos_pendientes || "[]").includes(FOTO_A.id));
    comprobar("vuelve la lápida del viaje borrado",
              JSON.parse(destino.almacen.viajes_borrados || "[]").includes("fantasma"));
    comprobar("vuelven los ajustes que importan",
              destino.almacen.ast_salida === "2026-09-01" && destino.almacen.nav_app === "maps");

    const fotos = await fotosDe(destino.w);
    const foto = fotos.find(f => f.id === FOTO_A.id), doc = fotos.find(f => f.id === DOC_A.id);
    comprobar("vuelven la foto y el documento", !!foto && !!doc, `${fotos.length} elementos`);
    comprobar("la foto conserva exactamente su contenido",
              foto && foto.datos === FOTO_A.datos && foto.xy === FOTO_A.xy && foto.cuando === FOTO_A.cuando);
    comprobar("el documento conserva su contenido y su nombre",
              doc && doc.datos === DOC_A.datos && doc.nombre === DOC_A.nombre && doc.doc === "tarjeta");

    // Restaurar dos veces no duplica
    const otraVez = await destino.w.eval(`restauraCopia(${JSON.stringify(texto)})`);
    comprobar("restaurar la misma copia otra vez sale bien", otraVez.ok === true, otraVez.motivo);
    comprobar("y no duplica nada",
              JSON.parse(destino.almacen.viajes_propios).length === 1 &&
              (await fotosDe(destino.w)).length === 2 &&
              otraVez.viajesNuevos === 0 && otraVez.fotosNuevas === 0);
  }

  /* ---- 5 · Lo de aquí no se pierde ---- */
  {
    const copia = JSON.stringify({
      app:"viajes.dtabuyodesigner", formato:1, creada:"2026-01-01T00:00:00.000Z",
      local:{
        viajes_propios: JSON.stringify([{ ...VIAJE_A, nombre:"Nombre viejo",
                                          actualizado:"2026-01-01T00:00:00.000Z" }]),
        diario_p1: JSON.stringify({ hechas:{ "0:1":50 }, desmarcadas:{}, notas:{} }),
        tema_viajes: "claro", nav_app: "waze"
      },
      fotos: []
    });

    const { w, almacen } = await abrePortada({
      viajes_propios: JSON.stringify([{ ...VIAJE_A, nombre:"Nombre nuevo",
                                        actualizado:"2026-08-20T00:00:00.000Z" }]),
      diario_p1: JSON.stringify(DIARIO_A),
      tema_viajes: "oscuro", nav_app: "maps"
    }, []);

    const res = await w.eval(`restauraCopia(${JSON.stringify(copia)})`);
    comprobar("restaurar una copia vieja sale bien", res.ok === true, res.motivo);
    comprobar("un viaje más nuevo aquí no lo pisa la copia vieja",
              JSON.parse(almacen.viajes_propios)[0].nombre === "Nombre nuevo",
              JSON.parse(almacen.viajes_propios)[0].nombre);
    const diario = JSON.parse(almacen.diario_p1);
    comprobar("el diario se funde: se queda lo de aquí y se suma lo de la copia",
              diario.hechas["0:0"] === 1000 && diario.hechas["0:1"] === 50 &&
              diario.notas["0"].t === "Qué día" && diario.visitas.length === 1,
              JSON.stringify(diario.hechas));
    comprobar("los ajustes de este móvil no se cambian",
              almacen.tema_viajes === "oscuro" && almacen.nav_app === "maps",
              `${almacen.tema_viajes} · ${almacen.nav_app}`);
  }

  /* ---- 6 · Las lápidas mandan ---- */
  {
    // Un viaje borrado aquí no vuelve porque esté en la copia
    const copia = JSON.stringify({
      app:"viajes.dtabuyodesigner", formato:1, creada:"2026-01-01T00:00:00.000Z",
      local:{ viajes_propios: JSON.stringify([VIAJE_A, { id:"vivo", nombre:"Vivo", dias:[] }]),
              viajes_borrados: JSON.stringify(["vivo"]) },
      fotos: []
    });
    const { w, almacen } = await abrePortada({
      viajes_propios: JSON.stringify([{ id:"vivo", nombre:"Vivo aquí", dias:[] }]),
      viajes_borrados: JSON.stringify(["p1"])
    }, []);

    const res = await w.eval(`restauraCopia(${JSON.stringify(copia)})`);
    comprobar("restaurar con lápidas sale bien", res.ok === true, res.motivo);
    const ids = JSON.parse(almacen.viajes_propios).map(v => v.id);
    comprobar("un viaje borrado aquí no resucita al restaurar",
              !ids.includes("p1"), ids.join(", "));
    comprobar("y la restauración lo dice", res.viajesNoResucitados === 1, res.viajesNoResucitados);
    comprobar("un viaje vivo aquí no lo mata una lápida de la copia",
              ids.includes("vivo"), ids.join(", "));
    comprobar("esa lápida de la copia se descarta",
              !JSON.parse(almacen.viajes_borrados).includes("vivo"),
              almacen.viajes_borrados);
    comprobar("la lápida de aquí se conserva",
              JSON.parse(almacen.viajes_borrados).includes("p1"), almacen.viajes_borrados);
    comprobar("un pendiente de un viaje que no está no se queda colgado",
              !JSON.parse(almacen.viajes_pendientes || "[]").includes("p1"));
  }

  /* ---- 7 · Si falla al escribir, se deshace ---- */
  {
    const origen = await abrePortada(almacenLleno(), [FOTO_A, DOC_A]);
    const texto = JSON.stringify((await origen.w.eval("copiaCompleta()")).copia);

    const { w, almacen } = await abrePortada({ tema_viajes:"oscuro" }, []);
    const antes = JSON.stringify(almacen);

    // El móvil deja escribir dos bloques y luego se queda sin sitio.
    // Es lo que hace iOS cuando el almacén se llena a mitad.
    let quedan = 2;
    const bueno = w.localStorage.setItem;
    w.localStorage.setItem = (k, v) => {
      if (quedan-- <= 0) throw new Error("QuotaExceededError");
      return bueno(k, v);
    };

    const res = await w.eval(`restauraCopia(${JSON.stringify(texto)})`);
    w.localStorage.setItem = bueno;

    comprobar("si el móvil no deja escribir, la restauración falla",
              res.ok === false, JSON.stringify(res));
    comprobar("y lo dice sin quedarse a medias en silencio",
              /no se pudo escribir/i.test(res.motivo || ""), res.motivo);
    comprobar("se deshace todo lo escrito", JSON.stringify(almacen) === antes,
              "quedó: " + JSON.stringify(almacen).slice(0, 120));
    comprobar("y se sacan las fotos que había metido",
              (await fotosDe(w)).length === 0, "quedaron fotos dentro");
    comprobar("y dice que ha podido deshacerlo del todo", res.revertido === true, res.revertido);
  }

  /* ---- 8 · Si no se puede leer el móvil, no hay copia ----
     Una lectura que falla y se toma por «no hay nada» daría un archivo
     sin viajes con toda la pinta de estar bien. Es el mismo riesgo que
     ya se evita cuando no se puede leer la tienda de fotos. */
  {
    // a) Falla una sola clave, la de los viajes
    const uno = await abrePortada(almacenLleno(), [FOTO_A, DOC_A]);
    const buenoUno = uno.w.localStorage.getItem;
    uno.w.localStorage.getItem = k => {
      if (k === "viajes_propios") throw new Error("SecurityError");
      return buenoUno(k);
    };
    const r1 = await uno.w.eval("copiaCompleta()");
    uno.w.localStorage.getItem = buenoUno;

    comprobar("si no se puede leer una clave, no se hace copia",
              !!r1.error && !r1.copia, JSON.stringify(r1).slice(0, 160));
    comprobar("y dice cuál no ha podido leer",
              /viajes_propios/.test(r1.error || ""), r1.error);
    comprobar("no devuelve una copia a medias",
              r1.copia === undefined, "devolvió copia");

    // b) Falla todo el almacén, como en el modo privado de iOS
    const todo = await abrePortada(almacenLleno(), [FOTO_A, DOC_A]);
    const buenoTodo = todo.w.localStorage.getItem;
    todo.w.localStorage.getItem = () => { throw new Error("SecurityError"); };

    const r2 = await todo.w.eval("copiaCompleta()");
    comprobar("si el almacén entero falla, tampoco se hace copia",
              !!r2.error && !r2.copia, JSON.stringify(r2).slice(0, 160));

    // Y lo que se ve en la portada
    todo.d.getElementById("btn-copia").click();
    await esperar(200);
    const zona = todo.d.getElementById("zona-copia");
    todo.w.localStorage.getItem = buenoTodo;

    comprobar("la portada lo explica en vez de ofrecer el archivo",
              /No se ha podido leer/.test(zona.textContent) &&
              !/Esto es lo que llevaría/.test(zona.textContent),
              zona.textContent.slice(0, 120));
    comprobar("y no aparece ningún botón de guardar el archivo",
              zona.querySelectorAll("a[download]").length === 0);
    comprobar("no deja errores de JavaScript por el camino",
              todo.dom.errores.length === 0, todo.dom.errores[0]);
  }
}

/* ═══ Las decisiones visuales ═══
   No se comprueba cada propiedad: se comprueban las decisiones que se
   tomaron y por qué. Y sobre elementos de verdad, leyendo el estilo que
   les aplica el navegador simulado, no buscando texto en el CSS. */

const APPS_VIAJE = [
  { nombre:"Eslovenia", ruta:"eslovenia/index.html", url:"https://x/eslovenia/",
    opciones:{ fecha:"2026-07-25T12:00:00" }, diario:"diario_eslovenia" },
  { nombre:"Asturias",  ruta:"asturias/index.html",  url:"https://x/asturias/",
    opciones:{}, diario:"diario_asturias" },
  { nombre:"visor",     ruta:"viaje/index.html",     url:"https://x/viaje/?id=p1",
    opciones:{}, diario:"diario_p1" }
];

/* Marca la primera parada de cualquier día: cada app elige el suyo */
const diarioConPrimeras = () => JSON.stringify({
  hechas: Object.fromEntries(Array.from({length:14}, (_, i) => [`${i}:0`, 1000])),
  desmarcadas:{}, notas:{}
});

/* El visor necesita un viaje con coordenadas: sin ellas no dibuja el mapa
   del día, y con él se va «situarme», que es una de las acciones a vigilar. */
const VIAJE_VISUAL = JSON.stringify([{ id:"p1", nombre:"Prueba", desde:"", hasta:"",
  dias:[{ t:"Día uno", dest:"Zagreb", paradas:[
    { h:"Mañana", txt:"Primera parada", n:"Con nota", mapa:"Zagreb", xy:"45.81,15.98" },
    { txt:"Segunda sin sitio" },
    { h:"Tarde", txt:"Tercera parada", mapa:"Split", xy:"43.51,16.44" }
  ] }] }]);

async function abreViaje(app, almacen = {}){
  if (app.diario === "diario_p1") almacen.viajes_propios = almacen.viajes_propios || VIAJE_VISUAL;
  const dom = abrir(app.ruta, { url:app.url, almacen, ...app.opciones });
  await esperar(700);
  return { dom, w:dom.window, d:dom.window.document, almacen };
}

/* La regla que el navegador tiene cargada, no el texto del archivo */
function reglaCSS(w, selector){
  for (const hoja of [...w.document.styleSheets]){
    let reglas = [];
    try { reglas = [...hoja.cssRules]; } catch { continue; }
    for (const r of reglas) if (r.selectorText === selector) return r.style;
  }
  return null;
}

const alto = (w, el) => w.getComputedStyle(el).minHeight;

async function lasDecisionesVisuales(){
  console.log(`\n${gris("──")} Cómo se ven las tres apps de viaje`);

  for (const app of APPS_VIAJE){
    // ---- Zona pulsable de los controles principales ----
    {
      const { d, w, dom } = await abreViaje(app);

      const btn = d.querySelector("#v-hoy .btn") || d.querySelector(".btn");
      comprobar(`${app.nombre}: los botones tienen 44 px de alto`,
                !!btn && alto(w, btn) === "44px", btn && alto(w, btn));

      const wz = d.querySelector("#v-hoy .wz");
      comprobar(`${app.nombre}: los chips de navegación llegan a 44 px`,
                !!wz && alto(w, wz) === "44px", wz && alto(w, wz));

      const alt = d.querySelector("#v-hoy .wz-alt");
      comprobar(`${app.nombre}: el atajo «ver» del chip es pulsable, no un adorno`,
                !!alt && alto(w, alt) === "44px" &&
                parseFloat(w.getComputedStyle(alt).fontSize) >= 12,
                alt && `${alto(w, alt)} · ${w.getComputedStyle(alt).fontSize}`);

      // El círculo de marcar va dentro del texto, así que no puede medir 44
      // sin descolocar la línea: se agranda la zona pulsable por debajo.
      const tick = d.querySelector("#v-hoy .tick");
      const reglaTick = reglaCSS(w, ".stop .tick::after") || reglaCSS(w, ".tick::after");
      const dentro = reglaTick && Math.abs(parseFloat(reglaTick.getPropertyValue("inset")));
      const zona = tick && (parseFloat(w.getComputedStyle(tick).width) + 2 * (dentro || 0));
      comprobar(`${app.nombre}: marcar una parada tiene 44 px de zona pulsable`,
                zona >= 44, `${zona} px`);

      // ---- El foco ----
      const foco = reglaCSS(w, ":focus-visible");
      comprobar(`${app.nombre}: el foco se ve (3 px o más)`,
                !!foco && parseFloat(foco.getPropertyValue("outline-width") ||
                          (foco.getPropertyValue("outline") || "").split(" ")[0]) >= 3,
                foco && foco.cssText);
      // El `border-radius` que llevaba antes se aplicaba al elemento, no al
      // anillo: al enfocar un botón redondo lo dejaba cuadrado.
      comprobar(`${app.nombre}: enfocar un botón no le cambia la forma`,
                !!foco && !foco.getPropertyValue("border-radius"),
                foco && foco.getPropertyValue("border-radius"));

      comprobar(`${app.nombre}: nada de esto rompe la carga`,
                dom.errores.length === 0, dom.errores[0]);
    }

    // ---- Una parada hecha se sigue leyendo ----
    {
      const { d, w } = await abreViaje(app, { [app.diario]: diarioConPrimeras() });
      const hecha = d.querySelector("#v-hoy .stop.hecho");
      comprobar(`${app.nombre}: hay una parada marcada para mirarla`, !!hecha);
      if (hecha){
        const p = hecha.querySelector("p");
        const cs = w.getComputedStyle(p);
        comprobar(`${app.nombre}: una parada hecha no se atenúa hasta no leerse`,
                  cs.opacity === "" || cs.opacity === "1", cs.opacity);
        comprobar(`${app.nombre}: su color sale del tema, no escrito a mano`,
                  /^var\(--/.test(cs.color), cs.color);
        // Que esté hecha no puede decirlo solo el color
        comprobar(`${app.nombre}: se sabe que está hecha sin mirar el color`,
                  /line-through/.test(cs.textDecoration || cs.textDecorationLine || "") &&
                  hecha.querySelector(".tick").textContent.trim() === "✓",
                  cs.textDecoration);
      }
    }

    // ---- Las acciones siguen donde estaban ----
    {
      const { d, w, dom } = await abreViaje(app);
      const hoy = d.getElementById("v-hoy");
      const debe = [[".wz", "chips de navegación"], [".tick", "marcar paradas"],
                    ["#abrir-conduccion", "modo conducción"],
                    ["input[type=file]", "cámara"], ["[data-mi-pos]", "situarme"]];
      const faltan = debe.filter(([sel]) => !hoy.querySelector(sel)).map(([, q]) => q);
      comprobar(`${app.nombre}: en Hoy siguen estando todas las acciones`,
                faltan.length === 0, "faltan: " + faltan.join(", "));

      // La entrada al modo conducción, separada del resto
      // El atajo `border-top` no lo computa bien el navegador simulado con
      // la hoja entera cargada, así que se lee la regla, que es lo que él
      // mismo tiene guardado.
      const conducir = hoy.querySelector(".conducir");
      const regla = reglaCSS(w, ".conducir");
      comprobar(`${app.nombre}: el modo conducción tiene su propio bloque separado`,
                !!conducir && /solid/.test(conducir.querySelector("button").className) &&
                !!regla && /var\(--/.test(regla.getPropertyValue("border-top")) &&
                parseFloat(w.getComputedStyle(conducir).paddingTop) >= 12,
                regla && regla.cssText);

      // Las pestañas siguen pintando
      const pestanas = [...d.querySelectorAll("nav button")];
      let vacias = 0;
      for (const b of pestanas){
        b.click(); await esperar(30);
        const v = d.getElementById("v-" + b.dataset.v);
        if (!v || v.innerHTML.trim().length < 40) vacias++;
      }
      comprobar(`${app.nombre}: las ${pestanas.length} pestañas siguen pintando`,
                pestanas.length >= 4 && vacias === 0, `${vacias} vacías`);
      comprobar(`${app.nombre}: recorrerlas no da errores`, dom.errores.length === 0, dom.errores[0]);
    }

    // ---- Claro y oscuro ----
    {
      const lee = async tema => {
        const { d } = await abreViaje(app, { tema_viajes: tema });
        return d.getElementById("v-hoy").textContent.replace(/\s+/g, " ").trim();
      };
      const oscuro = await lee("oscuro"), claro = await lee("claro");
      comprobar(`${app.nombre}: Hoy enseña lo mismo en claro y en oscuro`,
                oscuro === claro && oscuro.length > 100,
                `${oscuro.length} vs ${claro.length}`);
    }

    // ---- El modo conducción sigue siendo el mismo ----
    {
      const { d } = await abreViaje(app);
      d.getElementById("abrir-conduccion").click();
      const v = d.querySelector(".conduce");
      comprobar(`${app.nombre}: el modo conducción sigue enseñando una sola parada`,
                !!v && v.querySelectorAll("h1").length === 1,
                v && v.querySelectorAll("h1").length);
      comprobar(`${app.nombre}: y conserva sus mismos botones`,
                !!v && !!d.getElementById("cd-sig") && !!d.getElementById("cd-salir") &&
                (!!v.querySelector(".cd-ir") || /no tiene ubicación/.test(v.textContent)));
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
  await idsSinRepetir();
  posicionEnDosFormas();
  await nadaSePierdeEnLaNube();
  dependenciasEnServiceWorker();
  await editorConservaTodo();
  await viajesAMedidaEditables();
  await portadaSinRepetidos();
  await copiaIncompletaNoBorraBloques();
  await nadaSeQuedaEsperando();
  await elEstadoSeSabeDeVerdad();
  await elCentroDeEstado();
  await entrarYSalirVigilados();
  await nadaPrometeDeMas();
  await elMotorDeBusqueda();
  await buscarDesdeLaPantalla();
  await unaTandaCadaVez();
  await traspasoComprobado();
  await elBorradoNoResucita();
  await elModoConduccion();
  await laCopiaDeSeguridad();
  await lasDecisionesVisuales();

  console.log("\n" + gris("─".repeat(52)));
  if (fallos === 0) console.log(`  ${verde("Todo correcto")} · ${pruebas} comprobaciones\n`);
  else console.log(`  ${rojo(fallos + " fallo(s)")} de ${pruebas} comprobaciones\n`);
  process.exit(fallos ? 1 : 0);
})();
