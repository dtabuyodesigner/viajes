/* ═══════════════════════════════════════════════════════════
   Sincronización de viajes con Supabase.

   Reglas de la casa:
   · El móvil manda. Todo se guarda primero en local y la app
     funciona igual aunque no haya cobertura ni sesión.
   · La nube es un espejo. Si hay red y sesión, se iguala.
   · Ante conflicto, gana la versión modificada más tarde.
   ═══════════════════════════════════════════════════════════ */

const SB_URL  = "https://cmkzcvfjgrgxwqjimtxa.supabase.co";
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNta3pjdmZqZ3JneHdxamltdHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NzU5NzAsImV4cCI6MjEwMDM1MTk3MH0.epSiwj0MO9WWfqETVoEt2E_ijNSzi4x0d-TmgDhAWhQ";
const SB_CLAVE_VIAJES = "viajes_propios";
const SB_PENDIENTES   = "viajes_pendientes";
const SB_BORRADOS     = "viajes_borrados";

/* Ninguna espera es infinita: si no responde, se avisa */
function conTope(promesa, ms, fallo){
  return Promise.race([
    promesa,
    new Promise(r => setTimeout(() => r(fallo), ms))
  ]);
}

/* ¿Este error dice de verdad que la columna `extra` no existe?

   Importa acertar: si se toma por «no existe la columna» un fallo de red,
   un permiso denegado o una validación, se deja de mandar `extra` durante
   toda la sesión y los bloques del viaje no llegan al otro móvil. Y si se
   hila tan fino que no se reconoce nunca, contra una base antigua el viaje
   no se sube jamás. Por eso vale cualquiera de las dos señales. */
function esColumnaExtraAusente(error){
  if (!error || typeof error !== "object") return false;
  // PGRST204 es el código de PostgREST para «esa columna no está en el esquema»
  if (error.code === "PGRST204") return true;
  const txt = String(error.message || "").toLowerCase();
  return txt.includes("extra") && (txt.includes("schema cache") || txt.includes("column"));
}

/* Todo lo que no tiene columna propia en la tabla viaja junto, en `extra` */
const COLUMNAS_PROPIAS = ["id","nombre","desde","hasta","salida","dias",
                          "autor","actualizado","borrado","extra"];

function loDemas(viaje){
  const resto = {};
  for (const k of Object.keys(viaje || {}))
    if (!COLUMNAS_PROPIAS.includes(k)) resto[k] = viaje[k];
  return resto;
}

/* Ninguna llamada a la nube puede esperar para siempre. `conTope` deja
   pasar un fallo con motivo, que es lo que ya sabe manejar cada llamador:
   marcar el viaje como pendiente y reintentar más tarde. */
const NO_RESPONDE = { error: { message: "la nube no responde" } };
const TOPE_NUBE = 15000;

/* ---- Pedir algo por red con tope ----
   Aborta de verdad la petición al pasarse del tiempo, en vez de dejarla
   viva consumiendo batería, y explica el motivo en castellano llano para
   que el mensaje del botón diga qué pasó. */
async function fetchConTope(url, ms = 12000, opciones = {}){
  if (typeof fetch !== "function") throw new Error("este navegador no puede pedirlo");
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opciones, signal: ctrl.signal });
    if (!r.ok) throw new Error("el servidor respondió " + r.status);
    return r;
  } catch (e){
    if (e && e.name === "AbortError") throw new Error("tardó demasiado");
    if (!navigator.onLine) throw new Error("sin cobertura");
    throw e;
  } finally {
    clearTimeout(corte);
  }
}

/* ═══════════════════════════════════════════════════════════
   Cómo está el viaje: un solo sitio para las cinco apps.

   La pregunta que responde no es técnica. Es «¿está a salvo lo
   que he escrito, y lo verá el otro móvil?». Todo lo que no
   ayude a contestar eso se queda fuera: nombres de tablas,
   correos, reintentos, códigos de error.

   Dos cosas que NO se dicen porque no se pueden saber:

   · La hora de la última sincronización. La marca `actualizado`
     la pone siempre este móvil antes de mandar; no hay ninguna
     confirmada por el servidor. Enseñarla sería inventar.
   · Si el diario está subido. Cada gesto hace subir().catch(),
     y un fallo no deja rastro. No hay cola de pendientes.

   De ahí que nada diga «a salvo» ni «todo sincronizado» a secas:
   una frase así incluiría el diario, y del diario no se sabe. Se
   nombra siempre qué está cubierto — viajes y fotos — y el diario
   tiene su propia fila diciendo lo que hay.
   ═══════════════════════════════════════════════════════════ */

/* La raíz del sitio, mire desde donde mire. sync.js está en la raíz,
   así que su propia URL la da; si no se puede leer (en las pruebas va
   metido en línea), se deduce de la carpeta en la que estamos. */
function raizDelSitio(){
  try {
    const s = [...document.querySelectorAll("script[src]")]
      .find(x => /(^|\/)sync\.js(\?|$)/.test(x.getAttribute("src") || ""));
    if (s) return new URL(".", s.src).href;
  } catch {}
  try {
    const sub = ["eslovenia", "asturias", "viaje", "crear"];
    const partes = location.pathname.split("/").filter(Boolean);
    const ultima = partes[partes.length - 1];
    return new URL(sub.includes(ultima) ? "../" : "./", location.href).href;
  } catch { return "/"; }
}

/* Las cinco apps, con el prefijo de su caché. El prefijo, no el nombre
   entero: los nombres llevan versión y cambian en cada publicación. */
const APPS_GUARDABLES = [
  { nombre:"la portada", prefijo:"portada-",     pagina:"index.html" },
  { nombre:"Eslovenia",  prefijo:"eslovenia26-", pagina:"eslovenia/index.html" },
  { nombre:"Asturias",   prefijo:"asturias26-",  pagina:"asturias/index.html" },
  { nombre:"el visor",   prefijo:"generico-",    pagina:"viaje/index.html" },
  { nombre:"el editor",  prefijo:"editor-",      pagina:"crear/index.html" }
];

/* ¿Este móvil deja guardar? En modo privado de iOS, localStorage
   lanza excepción. Hay 26 sitios que escriben y solo uno avisa, así
   que se comprueba aquí de una vez. */
function puedeGuardar(){
  try {
    localStorage.setItem("_sitio_", "1");
    localStorage.removeItem("_sitio_");
    return true;
  } catch { return false; }
}

function loQueFaltaPorSubir(){
  const cuenta = f => { try { return f() || []; } catch { return []; } };
  return {
    viajes:   cuenta(() => SYNC.pendientes()).length,
    borrados: cuenta(() => SYNC.borrados()).length,
    fotos:    cuenta(() => typeof FOTOS !== "undefined" ? FOTOS.pendientes() : []).length
  };
}

/* ¿Está guardado lo justo para abrir cada app sin cobertura?

   Se afirma con lo que se puede comprobar de verdad: que existe la
   caché de esa app y que dentro está su página. No promete que estén
   todas las fotos ni todas las vistas: eso solo se guarda cuando se
   visitan con red, y decir lo contrario sería mentir.

   Devuelve null cuando no se puede saber, que no es lo mismo que «no». */
async function listoSinCobertura(){
  if (typeof caches === "undefined" || !navigator.serviceWorker) return null;
  let nombres;
  try { nombres = await conTope(caches.keys(), 4000, null); } catch { return null; }
  if (!nombres) return null;

  const raiz = raizDelSitio();
  const faltan = [];
  for (const app of APPS_GUARDABLES){
    const clave = nombres.find(n => n.startsWith(app.prefijo));
    if (!clave){ faltan.push(app.nombre); continue; }
    try {
      // Se abre solo una que ya existe: caches.open() crearía una vacía
      // y daría por buena una app que no está guardada.
      const c = await caches.open(clave);
      const hay = await c.match(new URL(app.pagina, raiz).href);
      if (!hay) faltan.push(app.nombre);
    } catch { faltan.push(app.nombre); }
  }
  return { listo: faltan.length === 0, faltan };
}

/* Cómo está todo, en un objeto. Nunca lanza: si algo no se puede
   saber, se dice que no se sabe, que no es lo mismo que decir que no. */
async function comoEstaTodo(){
  const guarda = puedeGuardar();
  const porSubir = loQueFaltaPorSubir();

  let nube = { clase:"sin-nube", txt:"solo en este móvil" };
  if (typeof SYNC !== "undefined"){
    try {
      const e = await SYNC.estado();
      if (e.login)      nube = { clase:"sin-sesion", txt:e.txt };
      else if (!e.ok)   nube = { clase:navigator.onLine ? "sin-respuesta" : "sin-cobertura", txt:e.txt };
      else              nube = { clase:"conectada", txt:e.txt, correo:e.correo || "" };
    } catch { nube = { clase:"sin-respuesta", txt:"la nube no responde" }; }
  }

  const total = porSubir.viajes + porSubir.borrados + porSubir.fotos;
  return { guarda, porSubir, total, nube, offline: await listoSinCobertura() };
}

/* El resumen de una línea. Glifo + texto: nunca solo el color, que con
   sol en la pantalla es lo primero que se pierde. */
function resumenDeEstado(e){
  const cuantos = [];
  if (e.porSubir.viajes)   cuantos.push(`${e.porSubir.viajes} viaje${e.porSubir.viajes === 1 ? "" : "s"}`);
  if (e.porSubir.fotos)    cuantos.push(`${e.porSubir.fotos} foto${e.porSubir.fotos === 1 ? "" : "s"}`);
  if (e.porSubir.borrados) cuantos.push("un borrado");
  const lista = cuantos.join(" y ");

  if (!e.guarda)
    return { nivel:"problema", glifo:"!", txt:"Este móvil no deja guardar", accion:null };

  if (e.nube.clase === "sin-sesion")
    return { nivel:"aviso", glifo:"!", txt:"Solo en este móvil", accion:"entrar" };

  if (e.nube.clase === "sin-cobertura")
    return { nivel:"aviso", glifo:"!",
             txt: e.total ? `Sin cobertura · ${lista} por subir` : "Sin cobertura · viajes y fotos al día",
             accion:null };

  if (e.nube.clase === "sin-respuesta")
    return { nivel:"aviso", glifo:"!",
             txt: e.total ? `La nube no responde · ${lista} por subir` : "La nube no responde",
             accion:"reintentar" };

  if (e.nube.clase === "sin-nube")
    return { nivel:"aviso", glifo:"!", txt:"Solo en este móvil", accion:null };

  // Nunca «a salvo» a secas ni «lo ve el otro móvil»: eso incluiría el
  // diario, y del diario no se sabe. Se nombra lo que sí se comprueba.
  return e.total
    ? { nivel:"aviso", glifo:"!", txt:`${lista} por subir`, accion:"reintentar" }
    : { nivel:"bien",  glifo:"✓", txt:"Viajes y fotos al día", accion:null };
}

/* Escapar aquí dentro. No se puede llamar `esc`: cada app declara el
   suyo con `const`, y dos declaraciones del mismo nombre en el ámbito
   global rompen la página entera antes de ejecutar nada. */
function escapaTexto(t){
  return String(t ?? "").replace(/[&<>"]/g,
    c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));
}

/* El resumen de una línea, para el sitio que cada app decida.
   El glifo va con aria-hidden porque el texto ya lo dice todo: si no,
   un lector de pantalla leería «signo de admiración» antes de la frase. */
function pintaResumenEn(nodo, r){
  if (!nodo) return;
  nodo.dataset.nivel = r.nivel;
  nodo.innerHTML =
    `<span class="est-glifo" aria-hidden="true">${r.glifo}</span> ` +
    `<span class="est-txt">${escapaTexto(r.txt)}</span>`;
}

const ACCIONES = {
  entrar:     "Entrar con tu cuenta",
  reintentar: "Reintentar ahora"
};

/* El detalle. Lo que le importa a una persona que va de viaje:
   si está a salvo, qué falta por subir, y si podrá abrirlo sin cobertura.
   Nada de correos, tablas, códigos ni reintentos. */
function detalleEstado(e){
  const r = resumenDeEstado(e);
  const filas = [];

  filas.push(["En este móvil", e.guarda
    ? "Guardado. Se abre sin cobertura."
    : "No se puede guardar. Si vas en modo privado, ciérralo."]);

  const p = e.porSubir;
  filas.push(["Viajes y fotos", e.total === 0 ? "Nada por subir"
    : [p.viajes && `${p.viajes} viaje${p.viajes === 1 ? "" : "s"}`,
       p.fotos && `${p.fotos} foto${p.fotos === 1 ? "" : "s"}`,
       p.borrados && "un borrado"].filter(Boolean).join(" · ") + " por subir"]);

  // El diario va aparte, y se dice lo que hay: se guarda aquí siempre,
  // pero de si llegó al otro móvil no queda constancia en ningún sitio.
  filas.push(["Diario", "Guardado en este móvil. No se puede confirmar si llegó al otro."]);

  filas.push(["La nube", e.nube.clase === "conectada"
    ? "Conectada. Los viajes y las fotos que subas los ve el otro móvil."
    : e.nube.clase === "sin-sesion" ? "Sin entrar. Por ahora solo se guarda aquí."
    : e.nube.clase === "sin-cobertura" ? "Sin cobertura. Subirán solos cuando vuelva."
    : "No responde. Se reintenta al sincronizar."]);

  filas.push(["Sin cobertura", !e.offline
    ? "No se puede comprobar en este móvil."
    : e.offline.listo
      ? "Todo guardado para abrirlo sin red."
      : `Abre con wifi antes de salir: ${e.offline.faltan.join(", ")}.`]);

  const accion = r.accion
    ? `<div class="btns"><button class="btn solid" id="est-accion" data-accion="${r.accion}">${ACCIONES[r.accion]}</button></div>`
    : "";

  return `<div class="est-detalle">
    ${filas.map(([a, b]) => `<div class="row"><span class="k">${escapaTexto(a)}</span><span class="v">${escapaTexto(b)}</span></div>`).join("")}
    ${accion}
    <p class="note">Los viajes y las fotos que queden pendientes suben solos en cuanto vuelva
       la línea, sin esperar aquí. Del diario no queda constancia: se guarda siempre en este
       móvil, pero no hay forma de saber si llegó al otro.</p>
  </div>`;
}

/* ---- Un botón que trabaja ----
   Tres cosas que hasta ahora no hacía ninguno:

   · No se puede pulsar dos veces. El segundo toque no hace nada, en vez
     de lanzar la operación otra vez (dos visitas, dos pernoctas, dos
     peticiones). Ningún botón de la app se desactivaba nunca.
   · Dice lo que está haciendo, y para un lector de pantalla también.
   · Vuelve SIEMPRE a su texto, también al fallar. Había seis sitios que
     dejaban «No se pudo» clavado para siempre.

   Si la tarea falla, se enseña el motivo real —no una frase amable— y el
   botón queda listo para reintentar en el acto. */
async function trabajando(boton, textoTrabajo, tarea, opciones = {}){
  const { fallo = "No se pudo", exito = null, vuelve = 2600 } = opciones;
  if (!boton) return tarea();
  if (boton.disabled) return;                 // ya está trabajando

  const original = boton.textContent;
  boton.disabled = true;
  boton.setAttribute("aria-busy", "true");
  boton.textContent = textoTrabajo;

  const suelta = () => {
    boton.disabled = false;
    boton.removeAttribute("aria-busy");
  };

  const luegoVuelve = () => setTimeout(() => {
    try { boton.textContent = original; } catch {}
  }, vuelve);

  try {
    const r = await tarea();
    if (exito){ boton.textContent = exito; suelta(); luegoVuelve(); }
    else { boton.textContent = original; suelta(); }
    return r;
  } catch (e) {
    // Aquí llegan tanto Error como los rechazos con un texto suelto que
    // usa DIARIO_SYNC: en los dos casos interesa el motivo, no un «no se pudo».
    const motivo = e && e.message ? String(e.message)
                 : typeof e === "string" ? e : "";
    boton.textContent = motivo && motivo !== fallo ? `${fallo} · ${motivo}` : fallo;
    suelta();                                 // se puede reintentar ya
    luegoVuelve();
    return undefined;
  }
}

const SYNC = {
  cliente: null,
  sesion: null,
  hayExtra: true,        // hasta que el servidor diga lo contrario

  /* ---- Local ---- */
  locales(){
    try { return JSON.parse(localStorage.getItem(SB_CLAVE_VIAJES)) || []; } catch { return []; }
  },
  guardarLocales(v){
    try { localStorage.setItem(SB_CLAVE_VIAJES, JSON.stringify(v)); return true; } catch { return false; }
  },
  pendientes(){
    try { return JSON.parse(localStorage.getItem(SB_PENDIENTES)) || []; } catch { return []; }
  },
  marcarPendiente(id){
    const p = new Set(this.pendientes()); p.add(id);
    try { localStorage.setItem(SB_PENDIENTES, JSON.stringify([...p])); } catch {}
  },
  /* ---- Borrados que todavía no se han podido aplicar en la nube ----
     Sin esto, borrar un viaje sin cobertura no sirve de nada: al volver la
     conexión, la fila remota sigue viva y el viaje resucita. */
  borrados(){
    try { return JSON.parse(localStorage.getItem(SB_BORRADOS)) || []; } catch { return []; }
  },
  marcarBorrado(id){
    const b = new Set(this.borrados()); b.add(id);
    try { localStorage.setItem(SB_BORRADOS, JSON.stringify([...b])); } catch {}
  },
  limpiarBorrado(id){
    try { localStorage.setItem(SB_BORRADOS,
      JSON.stringify(this.borrados().filter(x => x !== id))); } catch {}
  },

  limpiarPendiente(id){
    try { localStorage.setItem(SB_PENDIENTES,
      JSON.stringify(this.pendientes().filter(x => x !== id))); } catch {}
  },

  /* ---- Conexión ---- */
  async conectar(){
    if (this.cliente) return this.cliente;
    if (!navigator.onLine) return null;
    try {
      if (!window.supabase){
        const cargada = await new Promise(ok => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
          s.onload = () => ok(true);
          s.onerror = () => ok(false);
          document.head.appendChild(s);
          setTimeout(() => ok(false), 9000);
        });
        if (!cargada || !window.supabase) return null;
      }
      this.cliente = window.supabase.createClient(SB_URL, SB_KEY);
      const r = await conTope(this.cliente.auth.getSession(), 8000, { data:null });
      this.sesion = r?.data?.session || null;
      return this.cliente;
    } catch {
      this.cliente = null;
      return null;
    }
  },

  /* ---- Estado, para pintarlo en pantalla ---- */
  async estado(){
    return conTope(this._estado(), 12000,
      { ok:false, txt:"La nube no responde · solo en este móvil" });
  },

  async _estado(){
    if (!navigator.onLine) return { ok:false, txt:"Sin conexión · solo en este móvil" };
    const c = await this.conectar();
    if (!c) return { ok:false, txt:"No se pudo conectar · solo en este móvil" };
    if (!this.sesion) return { ok:false, txt:"Sin sesión", login:true };
    const p = this.pendientes().length;
    return { ok:true, correo: this.sesion.user?.email || "",
             txt: p ? `${p} viaje${p===1?"":"s"} por subir` : "Sincronizado", sesion:this.sesion };
  },

  /* ---- Entrar y salir ---- */
  async entrar(correo, clave){
    const c = await this.conectar();
    if (!c) return { ok:false, txt:"Sin conexión" };
    try {
      const r = await conTope(
        c.auth.signInWithPassword({ email:correo, password:clave }),
        15000, { error:{ message:"__tardando__" } });
      if (r.error) return { ok:false, txt: r.error.message === "Invalid login credentials"
        ? "Correo o contraseña incorrectos"
        : r.error.message === "__tardando__" ? "El servidor no responde. Reinténtalo."
        : r.error.message };
      this.sesion = r.data.session;
      return { ok:true };
    } catch (e){ return { ok:false, txt:"No se pudo entrar" }; }
  },

  async salir(){
    const c = await this.conectar();
    if (c) { try { await c.auth.signOut(); } catch {} }
    this.sesion = null;
  },

  /* ---- Subir un viaje ----
     La tabla tiene una columna por lo que se consulta (nombre, fechas,
     días) y una columna `extra` para todo lo demás: reservas, guía,
     normas, seguros… y lo que se invente más adelante. Así un bloque
     nuevo llega al otro móvil sin volver a tocar el SQL.
     Si la base de datos todavía no tiene `extra`, se sube sin ella: el
     viaje viaja igual y en el móvil no se pierde nada (ver _sincronizar). */
  async subir(viaje){
    const c = await this.conectar();
    if (!c || !this.sesion){ this.marcarPendiente(viaje.id); return false; }

    const fila = {
      id: viaje.id, nombre: viaje.nombre, desde: viaje.desde || "",
      hasta: viaje.hasta || "", salida: viaje.salida || "",
      dias: viaje.dias || [], autor: this.sesion.user?.email || "",
      actualizado: new Date().toISOString(), borrado: false
    };

    try {
      if (this.hayExtra){
        const { error } = await conTope(
          c.from("viajes").upsert({ ...fila, extra: loDemas(viaje) }), TOPE_NUBE, NO_RESPONDE);
        if (!error){ this.limpiarPendiente(viaje.id); return true; }
        // Solo si el error dice que la columna no está se reintenta sin ella.
        // Cualquier otro fallo se trata como fallo: queda pendiente y se
        // vuelve a intentar entero más tarde, con `extra` incluida.
        if (!esColumnaExtraAusente(error)) throw error;
        this.hayExtra = false;
      }
      const { error } = await conTope(c.from("viajes").upsert(fila), TOPE_NUBE, NO_RESPONDE);
      if (error) throw error;
      this.limpiarPendiente(viaje.id);
      return true;
    } catch {
      this.marcarPendiente(viaje.id);
      return false;
    }
  },

  /* ---- Marcar como borrado (para que desaparezca del otro móvil) ----
     La lápida se apunta ANTES de intentarlo, y solo se quita cuando el
     servidor confirma. Así, si no hay cobertura o el servidor falla, el
     borrado se reintenta en la siguiente sincronización en vez de perderse
     y dejar que el viaje vuelva. */
  async borrar(id){
    this.marcarBorrado(id);
    this.limpiarPendiente(id);        // borrar manda sobre un cambio sin subir

    const c = await this.conectar();
    if (!c || !this.sesion) return false;
    try {
      const { error } = await conTope(c.from("viajes")
        .update({ borrado:true, actualizado:new Date().toISOString() }).eq("id", id),
        TOPE_NUBE, NO_RESPONDE);
      if (error) throw error;
      this.limpiarBorrado(id);
      return true;
    } catch { return false; }
  },

  /* ---- Bajar y fundir con lo local ---- */
  async sincronizar(){
    return conTope(this._sincronizar(), 25000, { cambios:0, ok:false });
  },

  async _sincronizar(){
    const c = await this.conectar();
    if (!c || !this.sesion) return { cambios:0, ok:false };

    // Primero los borrados que quedaron a medias. Antes que nada: si un
    // viaje está borrado, subirlo primero lo resucitaría en el servidor.
    const borrados = new Set(this.borrados());
    for (const id of borrados) await this.borrar(id);

    // después, lo que quedó pendiente de subir
    const locales = this.locales();
    for (const id of this.pendientes()){
      if (borrados.has(id)){ this.limpiarPendiente(id); continue; }
      const v = locales.find(x => x.id === id);
      if (v) await this.subir(v); else this.limpiarPendiente(id);
    }

    let remotos = [];
    try {
      const { data, error } = await conTope(c.from("viajes").select("*"), TOPE_NUBE, NO_RESPONDE);
      if (error) throw error;
      remotos = data || [];
    } catch { return { cambios:0, ok:false }; }

    const porId = new Map(locales.map(v => [v.id, v]));
    let cambios = 0;

    for (const r of remotos){
      const l = porId.get(r.id);
      if (r.borrado){
        if (l){ porId.delete(r.id); cambios++; }
        this.limpiarBorrado(r.id);      // ya está aplicado: la lápida sobra
        continue;
      }
      // Borrado aquí y todavía no aplicado en la nube: no vuelve al móvil
      // ni se sube. Se reintentará arriba en la siguiente vuelta.
      if (borrados.has(r.id)){ porId.delete(r.id); continue; }
      // El móvil manda: se parte de lo que ya hay aquí y la nube encima.
      // Lo que la nube no sepa llevar (una base de datos sin `extra`, un
      // viaje subido por una versión antigua) no puede borrarlo.
      const nube = { ...(l || {}),
                     id:r.id, nombre:r.nombre, desde:r.desde||"", hasta:r.hasta||"",
                     salida:r.salida||"", dias:r.dias||[], actualizado:r.actualizado,
                     ...(r.extra || {}) };
      if (!l){ porId.set(r.id, nube); cambios++; continue; }
      // gana el más reciente
      const tl = Date.parse(l.actualizado || 0) || 0;
      const tr = Date.parse(r.actualizado || 0) || 0;
      if (tr > tl){ porId.set(r.id, nube); cambios++; }
      else if (tl > tr){ await this.subir(l); }
    }

    // lo que existe solo en el móvil, sube
    for (const l of locales){
      if (borrados.has(l.id)) continue;
      if (!remotos.some(r => r.id === l.id)) await this.subir(l);
    }

    this.guardarLocales([...porId.values()]);
    return { cambios, ok:true };
  }
};


/* ═══════════════════════════════════════════════════════════
   Diario compartido: paradas marcadas y notas de cada día.

   Cada entrada lleva su marca de tiempo, así que si los dos
   anotáis cosas distintas sin cobertura, al juntarse no se
   pierde ninguna: para cada parada gana el gesto más reciente.
   ═══════════════════════════════════════════════════════════ */

const DIARIO_SYNC = {
  clave(viaje){ return `diario_${viaje}`; },

  local(viaje){
    try {
      const d = JSON.parse(localStorage.getItem(this.clave(viaje)))
        || { hechas:{}, desmarcadas:{}, notas:{} };
      d.posiciones = d.posiciones || {};   // dónde estabas al marcar: { "5:0": {xy, ts} }
      d.visitas = d.visitas || [];         // «estoy aquí»: [{id, xy, ts, dia, txt}]
      d.pernoctas = d.pernoctas || [];     // dónde dormimos: [{id, xy, ts, dia, txt, tipo, valorada}]
      d.portadas = d.portadas || {};       // foto de portada por día: { "5": {id, ts} }
      return d;
    }
    catch { return { hechas:{}, desmarcadas:{}, notas:{}, posiciones:{}, visitas:[], pernoctas:[], portadas:{} }; }
  },

  guardarLocal(viaje, d){
    try { localStorage.setItem(this.clave(viaje), JSON.stringify(d)); } catch {}
  },

  /* ---- Gestos ---- */
  marcar(viaje, parada, marcada){
    const d = this.local(viaje), ahora = Date.now();
    if (marcada){ d.hechas[parada] = ahora; delete d.desmarcadas[parada]; }
    else { d.desmarcadas[parada] = ahora; delete d.hechas[parada]; }
    this.guardarLocal(viaje, d);
    this.subir(viaje).catch(()=>{});
    // y dónde estábamos: sin bloquear, y solo si el móvil lo da rápido
    if (marcada) this.apuntarDonde(viaje, parada);
  },

  apuntarDonde(viaje, parada){
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
      const d = this.local(viaje);
      d.posiciones[parada] = {
        xy: `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`,
        ts: Date.now()
      };
      this.guardarLocal(viaje, d);
      this.subir(viaje).catch(()=>{});
    }, () => {}, { enableHighAccuracy:false, timeout:8000, maximumAge:120000 });
  },

  /* Pregunta a OpenStreetMap cómo se llama este sitio */
  async comoSeLlama(la, lo){
    if (!navigator.onLine) return "";
    const u = `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
              `&lat=${la}&lon=${lo}&zoom=16&accept-language=es`;
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 9000);
    try {
      const r = await fetch(u, { signal: ctrl.signal });
      clearTimeout(corte);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      const a = d.address || {};
      // lo más concreto primero: el sitio, luego el pueblo, luego el municipio
      const sitio = d.name || a.tourism || a.amenity || a.natural || a.peak || "";
      const pueblo = a.village || a.hamlet || a.town || a.city || a.suburb || a.locality || "";
      const zona = a.municipality || a.county || "";
      const partes = [];
      if (sitio) partes.push(sitio);
      if (pueblo && pueblo !== sitio) partes.push(pueblo);
      if (!partes.length && zona) partes.push(zona);
      return partes.join(" · ");
    } catch { clearTimeout(corte); return ""; }
  },

  /* ---- «Estoy aquí»: marcar un sitio suelto, esté o no en el plan ---- */
  apuntarAqui(viaje, dia, txt){
    return new Promise((ok, mal) => {
      if (!navigator.geolocation) return mal("Este móvil no da la ubicación");
      navigator.geolocation.getCurrentPosition(async p => {
        const la = p.coords.latitude, lo = p.coords.longitude;
        const d = this.local(viaje);
        const v = {
          id: "v" + Date.now().toString(36),
          xy: `${la.toFixed(5)},${lo.toFixed(5)}`,
          ts: Date.now(), dia, txt: txt || "",
          precision: Math.round(p.coords.accuracy || 0)
        };
        d.visitas.push(v);
        this.guardarLocal(viaje, d);
        ok(v);                                   // se guarda ya, sin esperar al nombre
        // y por detrás, cómo se llama el sitio
        if (!txt){
          const nombre = await this.comoSeLlama(la, lo);
          if (nombre){
            const d2 = this.local(viaje);
            const v2 = (d2.visitas || []).find(x => x.id === v.id);
            if (v2 && !v2.txt){ v2.txt = nombre; v2.auto = true; this.guardarLocal(viaje, d2); }
          }
        }
        this.subir(viaje).catch(()=>{});
      }, () => mal("No se pudo obtener la ubicación"),
         { enableHighAccuracy:true, timeout:12000, maximumAge:20000 });
    });
  },

  /* Buscar un sitio por su nombre, para añadirlo después de haber pasado */
  async buscarSitio(texto, cerca){
    if (!navigator.onLine) return [];
    let u = `https://nominatim.openstreetmap.org/search?format=jsonv2` +
            `&q=${encodeURIComponent(texto)}&limit=6&accept-language=es`;
    if (cerca){                                  // prioriza lo que esté cerca del viaje
      const [la, lo] = cerca.split(",").map(Number);
      u += `&viewbox=${lo-1.5},${la+1.5},${lo+1.5},${la-1.5}&bounded=0`;
    }
    const ctrl = new AbortController();
    const corte = setTimeout(() => ctrl.abort(), 10000);
    try {
      const r = await fetch(u, { signal: ctrl.signal });
      clearTimeout(corte);
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      return (d || []).map(x => ({
        nombre: (x.name || x.display_name || "").split(",")[0].trim(),
        donde: (x.display_name || "").split(",").slice(1, 3).join(",").trim(),
        xy: `${Number(x.lat).toFixed(5)},${Number(x.lon).toFixed(5)}`
      })).filter(x => x.nombre);
    } catch { clearTimeout(corte); return []; }
  },

  /* Añade un punto a un día ya pasado, colocándolo en su sitio del recorrido */
  anadirVisita(viaje, dia, nombre, xy, fechaDia){
    const d = this.local(viaje);
    // la hora se calcula para que quede en orden dentro de ese día
    const base = fechaDia ? new Date(fechaDia + "T09:00:00").getTime() : Date.now();
    const cuantas = (d.visitas || []).filter(v => String(v.dia) === String(dia) && !v.borrada).length;
    const v = {
      id: "v" + Date.now().toString(36),
      xy, ts: base + cuantas * 20 * 60 * 1000,   // veinte minutos entre punto y punto
      dia, txt: nombre, manual: true
    };
    d.visitas.push(v);
    this.guardarLocal(viaje, d);
    this.subir(viaje).catch(()=>{});
    return v;
  },

  visitasDelDia(viaje, dia){
    return (this.local(viaje).visitas || [])
      .filter(v => String(v.dia) === String(dia) && !v.borrada)
      .sort((a,b) => a.ts - b.ts);
  },

  renombrarVisita(viaje, id, txt){
    const d = this.local(viaje);
    const v = (d.visitas || []).find(x => x.id === id);
    if (!v) return;
    v.txt = txt; v.ts_txt = Date.now();
    this.guardarLocal(viaje, d);
    this.subir(viaje).catch(()=>{});
  },

  borrarVisita(viaje, id){
    const d = this.local(viaje);
    const v = (d.visitas || []).find(x => x.id === id);
    if (!v) return;
    v.borrada = true; v.ts_txt = Date.now();
    this.guardarLocal(viaje, d);
    this.subir(viaje).catch(()=>{});
  },

  /* ---- Dónde dormimos: para volver, o para no volver ---- */
  async apuntarPernocta(viaje, dia, datos = {}){
    return new Promise((ok, mal) => {
      if (!navigator.geolocation) return mal("Este móvil no da la ubicación");
      navigator.geolocation.getCurrentPosition(async p => {
        const la = p.coords.latitude, lo = p.coords.longitude;
        const d = this.local(viaje);
        d.pernoctas = d.pernoctas || [];
        const n = {
          id: "p" + Date.now().toString(36),
          xy: `${la.toFixed(5)},${lo.toFixed(5)}`,
          ts: Date.now(), dia,
          txt: datos.txt || "", tipo: datos.tipo || "", nota: datos.nota || "",
          valorada: datos.valorada || 0        // 0 sin valorar, 1 mal, 2 normal, 3 repetiría
        };
        d.pernoctas.push(n);
        this.guardarLocal(viaje, d);
        ok(n);
        if (!n.txt){
          const nombre = await this.comoSeLlama(la, lo);
          if (nombre){
            const d2 = this.local(viaje);
            const n2 = (d2.pernoctas || []).find(x => x.id === n.id);
            if (n2 && !n2.txt){ n2.txt = nombre; n2.auto = true; this.guardarLocal(viaje, d2); }
          }
        }
        this.subir(viaje).catch(()=>{});
      }, () => mal("No se pudo obtener la ubicación"),
         { enableHighAccuracy:true, timeout:12000, maximumAge:20000 });
    });
  },

  pernoctaDelDia(viaje, dia){
    return (this.local(viaje).pernoctas || [])
      .filter(x => String(x.dia) === String(dia) && !x.borrada)
      .sort((a,b) => b.ts - a.ts)[0] || null;
  },

  todasLasPernoctas(viaje){
    return (this.local(viaje).pernoctas || [])
      .filter(x => !x.borrada).sort((a,b) => a.ts - b.ts);
  },

  editarPernocta(viaje, id, cambios){
    const d = this.local(viaje);
    const n = (d.pernoctas || []).find(x => x.id === id);
    if (!n) return;
    Object.assign(n, cambios, { ts_edit: Date.now() });
    this.guardarLocal(viaje, d);
    this.subir(viaje).catch(()=>{});
  },

  borrarPernocta(viaje, id){
    this.editarPernocta(viaje, id, { borrada: true });
  },

  /* ---- Foto de portada del día ---- */
  portada(viaje, dia){ return this.local(viaje).portadas?.[dia]?.id || null; },
  ponPortada(viaje, dia, id){
    const d = this.local(viaje);
    if (d.portadas[dia]?.id === id) delete d.portadas[dia];
    else d.portadas[dia] = { id, ts: Date.now() };
    this.guardarLocal(viaje, d);
    this.subir(viaje).catch(()=>{});
  },

  /* Los sitios donde estuvisteis de verdad, en orden */
  recorridoReal(viaje){
    const d = this.local(viaje);
    const deMarcas = Object.entries(d.posiciones || {})
      .map(([clave, v]) => ({ dia: +clave.split(":")[0], xy: v.xy, ts: v.ts, tipo: "marca" }));
    const deVisitas = (d.visitas || []).filter(v => !v.borrada)
      .map(v => ({ dia: v.dia, xy: v.xy, ts: v.ts, txt: v.txt, tipo: "visita" }));
    return [...deMarcas, ...deVisitas].filter(x => x.xy).sort((a, b) => a.ts - b.ts);
  },

  anotar(viaje, dia, texto){
    const d = this.local(viaje);
    d.notas[dia] = { t: texto, ts: Date.now() };
    this.guardarLocal(viaje, d);
    clearTimeout(this._espera);
    this._espera = setTimeout(() => this.subir(viaje).catch(()=>{}), 2500);
  },

  /* ---- Consultas ---- */
  estaHecha(viaje, parada){ return !!this.local(viaje).hechas[parada]; },
  nota(viaje, dia){ return this.local(viaje).notas[dia]?.t || ""; },

  /* ---- Fundir dos versiones sin perder nada ---- */
  fundir(a, b){
    const r = { hechas:{}, desmarcadas:{}, notas:{} };
    const claves = new Set([
      ...Object.keys(a.hechas||{}), ...Object.keys(a.desmarcadas||{}),
      ...Object.keys(b.hechas||{}), ...Object.keys(b.desmarcadas||{})
    ]);
    for (const k of claves){
      const marcada   = Math.max(a.hechas?.[k] || 0, b.hechas?.[k] || 0);
      const desmarcada = Math.max(a.desmarcadas?.[k] || 0, b.desmarcadas?.[k] || 0);
      if (marcada === 0 && desmarcada === 0) continue;
      if (marcada >= desmarcada) r.hechas[k] = marcada;
      else r.desmarcadas[k] = desmarcada;
    }
    const dias = new Set([...Object.keys(a.notas||{}), ...Object.keys(b.notas||{})]);
    for (const k of dias){
      const na = a.notas?.[k], nb = b.notas?.[k];
      if (!na) { r.notas[k] = nb; continue; }
      if (!nb) { r.notas[k] = na; continue; }
      r.notas[k] = (nb.ts || 0) > (na.ts || 0) ? nb : na;
    }

    // las visitas se acumulan: cada una tiene su id, gana la versión más retocada
    const porId = new Map();
    for (const v of [...(a.visitas||[]), ...(b.visitas||[])]){
      const antes = porId.get(v.id);
      if (!antes || (v.ts_txt || v.ts || 0) > (antes.ts_txt || antes.ts || 0)) porId.set(v.id, v);
    }
    r.visitas = [...porId.values()].sort((x,y) => x.ts - y.ts);

    const pn = new Map();
    for (const x of [...(a.pernoctas||[]), ...(b.pernoctas||[])]){
      const antes = pn.get(x.id);
      if (!antes || (x.ts_edit || x.ts || 0) > (antes.ts_edit || antes.ts || 0)) pn.set(x.id, x);
    }
    r.pernoctas = [...pn.values()].sort((x,y) => x.ts - y.ts);

    r.portadas = {};
    const dp = new Set([...Object.keys(a.portadas||{}), ...Object.keys(b.portadas||{})]);
    for (const k of dp){
      const pa = a.portadas?.[k], pb = b.portadas?.[k];
      if (!pa) { r.portadas[k] = pb; continue; }
      if (!pb) { r.portadas[k] = pa; continue; }
      r.portadas[k] = (pb.ts || 0) > (pa.ts || 0) ? pb : pa;
    }

    r.posiciones = {};
    const sitios = new Set([...Object.keys(a.posiciones||{}), ...Object.keys(b.posiciones||{})]);
    for (const k of sitios){
      const pa = a.posiciones?.[k], pb = b.posiciones?.[k];
      if (!pa) { r.posiciones[k] = pb; continue; }
      if (!pb) { r.posiciones[k] = pa; continue; }
      r.posiciones[k] = (pb.ts || 0) > (pa.ts || 0) ? pb : pa;   // el primero que llegó manda
    }
    return r;
  },

  async subir(viaje){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return false;
    const d = this.local(viaje);
    try {
      const { error } = await conTope(c.from("viaje_diario").upsert({
        viaje, hechas:d.hechas, desmarcadas:d.desmarcadas, notas:d.notas,
        posiciones:d.posiciones, visitas:d.visitas, pernoctas:d.pernoctas, portadas:d.portadas,
        actualizado: new Date().toISOString()
      }), TOPE_NUBE, NO_RESPONDE);
      return !error;
    } catch { return false; }
  },

  /* Baja lo del otro móvil, lo funde y devuelve si algo cambió */
  async sincronizar(viaje){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return { ok:false, cambios:false };
    let remoto = null;
    try {
      const { data, error } = await conTope(c.from("viaje_diario")
        .select("*").eq("viaje", viaje).maybeSingle(), TOPE_NUBE, NO_RESPONDE);
      if (error) throw error;
      remoto = data;
    } catch { return { ok:false, cambios:false }; }

    const antes = this.local(viaje);
    if (!remoto){ await this.subir(viaje); return { ok:true, cambios:false }; }

    const fundido = this.fundir(antes, {
      hechas: remoto.hechas || {}, desmarcadas: remoto.desmarcadas || {},
      notas: remoto.notas || {}, posiciones: remoto.posiciones || {},
      visitas: remoto.visitas || [], pernoctas: remoto.pernoctas || [], portadas: remoto.portadas || {}
    });
    const cambios = JSON.stringify(fundido) !== JSON.stringify(antes);
    this.guardarLocal(viaje, fundido);
    if (cambios) await this.subir(viaje);
    return { ok:true, cambios };
  }
};


/* ═══════════════════════════════════════════════════════════
   Fotos del viaje.

   Van en IndexedDB, no en localStorage: allí solo caben unos
   5 MB en total y tres fotos ya lo llenarían. Aquí caben
   cientos.

   Se guardan primero en el móvil y se suben aparte, a su propia
   tabla (viaje_fotos): meterlas en la fila del viaje sería pesado,
   porque una foto comprimida son unos 100 KB. subir() y
   pendientes() llevan esa cola.

   Las tarjetas de embarque NO suben: llevan nombre y código de
   barras. Se quedan en este móvil.
   ═══════════════════════════════════════════════════════════ */

const FOTOS = {
  _bd: null,

  async abrir(){
    if (this._bd) return this._bd;
    if (!window.indexedDB) return null;
    return new Promise(ok => {
      const p = indexedDB.open("viajes_fotos", 1);
      p.onupgradeneeded = () => {
        const bd = p.result;
        if (!bd.objectStoreNames.contains("fotos"))
          bd.createObjectStore("fotos", { keyPath: "id" });
      };
      p.onsuccess = () => { this._bd = p.result; ok(this._bd); };
      p.onerror = () => ok(null);
      setTimeout(() => ok(null), 5000);
    });
  },

  async _tienda(modo){
    const bd = await this.abrir();
    if (!bd) return null;
    try { return bd.transaction("fotos", modo).objectStore("fotos"); }
    catch { return null; }
  },

  /* Guarda una foto y devuelve su id */
  async guardar(viaje, dia, datos, xy){
    const t = await this._tienda("readwrite");
    if (!t) return null;
    const id = `${viaje}:${dia}:${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const guardado = await new Promise(ok => {
      const p = t.put({ id, viaje, dia, datos, xy: xy || null, cuando: Date.now() });
      p.onsuccess = () => ok(id);
      p.onerror = () => ok(null);
    });
    if (guardado) this.subir(id).catch(()=>{});
    return guardado;
  },

  /* Todas las de un día, de la más antigua a la más nueva */
  async delDia(viaje, dia){
    const t = await this._tienda("readonly");
    if (!t) return [];
    return new Promise(ok => {
      const fuera = [];
      const p = t.openCursor();
      p.onsuccess = e => {
        const c = e.target.result;
        if (!c) return ok(fuera.sort((a,b) => a.cuando - b.cuando));
        if (c.value.viaje === viaje && String(c.value.dia) === String(dia) && !c.value.doc)
          fuera.push(c.value);
        c.continue();
      };
      p.onerror = () => ok([]);
    });
  },

  /* Cuántas hay por día, para pintar las miniaturas de la lista */
  async cuentaPorDia(viaje){
    const t = await this._tienda("readonly");
    if (!t) return {};
    return new Promise(ok => {
      const n = {};
      const p = t.openCursor();
      p.onsuccess = e => {
        const c = e.target.result;
        if (!c) return ok(n);
        if (c.value.viaje === viaje && !c.value.doc) n[c.value.dia] = (n[c.value.dia] || 0) + 1;
        c.continue();
      };
      p.onerror = () => ok({});
    });
  },

  async una(id){ return this._porId(id); },

  /* ---- Para la copia de seguridad ---- */

  /* Todo lo guardado aquí: fotos y documentos. Devuelve null si no se
     puede leer la tienda, que no es lo mismo que «no hay nada». */
  async todas(){
    const t = await this._tienda("readonly");
    if (!t) return null;
    return new Promise(ok => {
      const fuera = [];
      const p = t.openCursor();
      p.onsuccess = e => {
        const c = e.target.result;
        if (!c) return ok(fuera);
        fuera.push(c.value);
        c.continue();
      };
      p.onerror = () => ok(null);
    });
  },

  /* Mete varias de una vez. Una transacción de IndexedDB sí es atómica
     de verdad: o entran todas o no entra ninguna. Devuelve cuántas, o
     null si no se pudo. */
  async meterVarias(lista){
    if (!lista || !lista.length) return 0;
    const bd = await this.abrir();
    if (!bd) return null;
    return new Promise(ok => {
      let t;
      try { t = bd.transaction("fotos", "readwrite"); } catch { return ok(null); }
      t.oncomplete = () => ok(lista.length);
      t.onerror = () => ok(null);
      t.onabort = () => ok(null);
      const tienda = t.objectStore("fotos");
      try { for (const f of lista) tienda.put(f); } catch { try { t.abort(); } catch {} ; ok(null); }
    });
  },

  /* Quita varias por id. Solo se usa para deshacer una restauración a
     medias: no marca nada como borrado en la nube. */
  async quitarVarias(ids){
    if (!ids || !ids.length) return true;
    const bd = await this.abrir();
    if (!bd) return false;
    return new Promise(ok => {
      let t;
      try { t = bd.transaction("fotos", "readwrite"); } catch { return ok(false); }
      t.oncomplete = () => ok(true);
      t.onerror = () => ok(false);
      t.onabort = () => ok(false);
      const tienda = t.objectStore("fotos");
      try { for (const id of ids) tienda.delete(id); } catch { try { t.abort(); } catch {} ; ok(false); }
    });
  },

  async borrar(id){
    const t = await this._tienda("readwrite");
    if (!t) return false;
    const fuera = await new Promise(ok => {
      const p = t.delete(id);
      p.onsuccess = () => ok(true);
      p.onerror = () => ok(false);
    });
    this.marcarBorradaFuera(id).catch(()=>{});
    return fuera;
  },

  /* ---- Compartir con el otro móvil ---- */

  pendientes(){
    try { return JSON.parse(localStorage.getItem("fotos_pendientes")) || []; } catch { return []; }
  },
  _apuntarPendiente(id){
    const p = new Set(this.pendientes()); p.add(id);
    try { localStorage.setItem("fotos_pendientes", JSON.stringify([...p])); } catch {}
  },
  _quitarPendiente(id){
    try { localStorage.setItem("fotos_pendientes",
      JSON.stringify(this.pendientes().filter(x => x !== id))); } catch {}
  },

  async _porId(id){
    const t = await this._tienda("readonly");
    if (!t) return null;
    return new Promise(ok => {
      const p = t.get(id);
      p.onsuccess = () => ok(p.result || null);
      p.onerror = () => ok(null);
    });
  },

  async subir(id){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion){ this._apuntarPendiente(id); return false; }
    const f = await this._porId(id);
    if (!f){ this._quitarPendiente(id); return false; }
    try {
      const { error } = await conTope(c.from("viaje_fotos").upsert({
        id: f.id, viaje: f.viaje, dia: f.dia, datos: f.datos,
        autor: SYNC.sesion.user?.email || "", borrada: false
      }), TOPE_NUBE, NO_RESPONDE);
      if (error) throw error;
      this._quitarPendiente(id);
      return true;
    } catch { this._apuntarPendiente(id); return false; }
  },

  async marcarBorradaFuera(id){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return false;
    try {
      await conTope(c.from("viaje_fotos").update({ borrada:true }).eq("id", id),
                    TOPE_NUBE, NO_RESPONDE);
      this._quitarPendiente(id);
      return true;
    } catch { return false; }
  },

  /* Trae del otro móvil las fotos de un día que aquí no estén.
     Primero pregunta qué ids hay (ligero) y solo baja las que faltan. */
  async traerDelDia(viaje, dia){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return 0;

    // lo pendiente de subir, primero
    for (const id of this.pendientes()) await this.subir(id);

    let fuera = [];
    try {
      const { data, error } = await conTope(c.from("viaje_fotos")
        .select("id,borrada").eq("viaje", viaje).eq("dia", dia), TOPE_NUBE, NO_RESPONDE);
      if (error) throw error;
      fuera = data || [];
    } catch { return 0; }

    const aqui = new Set((await this.delDia(viaje, dia)).map(f => f.id));
    let nuevas = 0;

    for (const f of fuera){
      if (f.borrada){
        if (aqui.has(f.id)){
          const t = await this._tienda("readwrite");
          if (t) t.delete(f.id);
          nuevas++;
        }
        continue;
      }
      if (aqui.has(f.id)) continue;
      try {
        const { data, error } = await conTope(c.from("viaje_fotos")
          .select("id,viaje,dia,datos,cuando").eq("id", f.id).maybeSingle(),
          TOPE_NUBE, NO_RESPONDE);
        if (error || !data) continue;
        const t = await this._tienda("readwrite");
        if (!t) continue;
        t.put({ id:data.id, viaje:data.viaje, dia:data.dia, datos:data.datos,
                cuando: Date.parse(data.cuando) || Date.now() });
        nuevas++;
      } catch {}
    }
    return nuevas;
  },

  /* ---- Documentos: tarjetas de embarque, reservas, seguros ---- */
  /* Varios documentos por clave: en un vuelo hay una tarjeta por persona */
  async guardarDoc(viaje, clave, datos, nombre){
    const t = await this._tienda("readwrite");
    if (!t) return null;
    // dos archivos seguidos caen en el mismo milisegundo: hace falta algo más
    const id = `doc:${viaje}:${clave}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    return new Promise(ok => {
      const p = t.put({ id, viaje, dia:-1, doc:clave, nombre: nombre || "", datos, cuando: Date.now() });
      p.onsuccess = () => ok(id);
      p.onerror = () => ok(null);
    });
  },

  /* Todos los de una clave, en el orden en que se guardaron */
  async docs(viaje, clave){
    const t = await this._tienda("readonly");
    if (!t) return [];
    return new Promise(ok => {
      const fuera = [];
      const p = t.openCursor();
      p.onsuccess = e => {
        const c = e.target.result;
        if (!c) return ok(fuera.sort((a,b) => a.cuando - b.cuando));
        if (c.value.viaje === viaje && c.value.doc === clave) fuera.push(c.value);
        c.continue();
      };
      p.onerror = () => ok([]);
    });
  },

  async borrarDoc(viaje, id){
    const t = await this._tienda("readwrite");
    if (!t) return false;
    return new Promise(ok => {
      const p = t.delete(id);
      p.onsuccess = () => ok(true);
      p.onerror = () => ok(false);
    });
  },

  /* Cuánto ocupan, para avisar antes de llenar el móvil */
  async espacio(){
    try {
      if (!navigator.storage?.estimate) return null;
      const e = await navigator.storage.estimate();
      return { usado: e.usage || 0, total: e.quota || 0 };
    } catch { return null; }
  }
};

/* Comprime antes de guardar: una foto de iPhone son 4 MB, esto la deja en ~120 KB */
function comprimirFoto(archivo, maxLado = 1400, calidad = 0.75){
  return new Promise((ok, mal) => {
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width:a, height:b } = img;
        const f = Math.min(1, maxLado / Math.max(a, b));
        a = Math.round(a * f); b = Math.round(b * f);
        const c = document.createElement("canvas");
        c.width = a; c.height = b;
        c.getContext("2d").drawImage(img, 0, 0, a, b);
        ok(c.toDataURL("image/jpeg", calidad));
      };
      img.onerror = mal;
      img.src = lector.result;
    };
    lector.onerror = mal;
    lector.readAsDataURL(archivo);
  });
}

// Reintento automático al recuperar la cobertura
window.addEventListener("online", () => {
  SYNC.sincronizar().catch(()=>{});
  FOTOS.pendientes().forEach(id => FOTOS.subir(id).catch(()=>{}));
});

/* ═══════════════════════════════════════════════════════════
   Copia de seguridad manual

   Un archivo, todo lo que este móvil guarda, y vuelta atrás sin
   perder nada de lo que ya hay aquí.

   La lista de claves es EXPLÍCITA a propósito. Volcar `localStorage`
   entero sería más corto y metería en el archivo la sesión de
   Supabase y la contraseña guardada de Eslovenia. Lo que no está en
   esta lista no sale en la copia.
   ═══════════════════════════════════════════════════════════ */

const COPIA_ID = "viajes.dtabuyodesigner";
const COPIA_FORMATO = 1;

/* Preferencias que merece la pena conservar. Las de un solo uso no. */
const COPIA_AJUSTES = ["tema_viajes",
  "nav_app", "nav_via", "nav_avisar",
  "ast_app", "ast_via", "ast_avisar", "ast_salida",
  "gen_app", "gen_avisar"];

/* Los viajes que pueden tener diario: los dos con app propia, y los
   del móvil. No se enumera `localStorage`: el banco de pruebas no
   puede, y una lista derivada de los datos es igual de completa. */
function viajesConDiario(){
  const ids = ["eslovenia", "asturias"];
  for (const v of SYNC.locales()) if (v && v.id && !ids.includes(v.id)) ids.push(v.id);
  return ids;
}

function clavesDeCopia(){
  const claves = ["viajes_propios", "viajes_pendientes", "viajes_borrados", "fotos_pendientes",
                  "eslo_hechas", "eslo_notas", "astu_hechas", "astu_notas"];
  for (const id of viajesConDiario()){
    claves.push(`diario_${id}`, `vp_${id}_hechas`, `vp_${id}_notas`);
  }
  return claves.concat(COPIA_AJUSTES);
}

const leeClave = k => { try { return localStorage.getItem(k); } catch { return null; } };
const leeJSON = (texto, def) => { try { const v = JSON.parse(texto); return v ?? def; } catch { return def; } };
const listaDe = texto => { const v = leeJSON(texto, []); return Array.isArray(v) ? v : []; };

/* Para la copia hace falta distinguir tres cosas, no dos: que la clave
   no esté, que esté con un valor, y que `localStorage` no haya dejado
   leerla. `leeClave` mezcla la primera y la tercera —y para restaurar
   está bien así, porque «no está» y «no se sabe» llevan a lo mismo:
   rellenar solo lo que falte—, pero al hacer la copia no: una lectura
   que falla y se toma por «no hay nada» produce un archivo sin viajes
   que parece correcto. */
function leeClaveParaCopia(k){
  try { return { ok:true, valor: localStorage.getItem(k) }; }
  catch { return { ok:false }; }
}

/* La copia entera. Si algo no se puede leer no se hace copia: un
   archivo que dice tener cero fotos cuando hay cientos, o ningún viaje
   cuando hay diez, es peor que no tener archivo. */
async function copiaCompleta(){
  const fotos = await FOTOS.todas();
  if (fotos === null) return { error:"No se han podido leer las fotos guardadas en este móvil. La copia no estaría completa, así que no se ha hecho." };

  const local = {};
  for (const k of clavesDeCopia()){
    const r = leeClaveParaCopia(k);
    if (!r.ok) return { error:`No se ha podido leer «${k}» del almacenamiento de este móvil. La copia no estaría completa, así que no se ha hecho.` };
    if (r.valor !== null) local[k] = r.valor;   // tal cual está: ni se interpreta ni se reescribe
  }
  return { copia: { app: COPIA_ID, formato: COPIA_FORMATO,
                    creada: new Date().toISOString(), local, fotos } };
}

/* Qué lleva dentro, para enseñarlo antes de descargar */
function resumenDeCopia(copia){
  const local = copia.local || {};
  const fotos = (copia.fotos || []).filter(f => !f.doc).length;
  const docs  = (copia.fotos || []).filter(f => f.doc).length;

  let diario = 0;
  for (const k of Object.keys(local)){
    if (!k.startsWith("diario_")) continue;
    const d = leeJSON(local[k], {}) || {};
    diario += Object.keys(d.hechas || {}).length
            + Object.keys(d.notas || {}).length
            + (d.visitas || []).length
            + (d.pernoctas || []).length;
  }
  return {
    viajes: listaDe(local.viajes_propios).length,
    diario, fotos, documentos: docs,
    pendientes: listaDe(local.viajes_pendientes).length + listaDe(local.fotos_pendientes).length,
    borrados: listaDe(local.viajes_borrados).length
  };
}

function nombreDeCopia(copia){
  const f = String(copia.creada || "").slice(0, 10) || "sin-fecha";
  return `viajes-copia-${f}.json`;
}

/* ---- Comprobar antes de tocar nada ----
   Devuelve el motivo en castellano y no escribe en ningún almacén. */
function validaCopia(texto){
  if (typeof texto !== "string" || !texto.trim())
    return { ok:false, motivo:"El archivo está vacío." };

  let c;
  try { c = JSON.parse(texto); }
  catch { return { ok:false, motivo:"El archivo no es un JSON válido. ¿Seguro que es una copia de esta app?" }; }

  if (!c || typeof c !== "object" || Array.isArray(c))
    return { ok:false, motivo:"El archivo no tiene la forma de una copia." };
  if (c.app !== COPIA_ID)
    return { ok:false, motivo:"Este archivo no es una copia de las apps de viaje." };
  if (c.formato !== COPIA_FORMATO)
    return { ok:false, motivo:`La copia es del formato ${c.formato ?? "desconocido"} y esta versión entiende el ${COPIA_FORMATO}.` };
  if (!c.local || typeof c.local !== "object" || Array.isArray(c.local))
    return { ok:false, motivo:"A la copia le falta el bloque de datos." };
  if (!Array.isArray(c.fotos))
    return { ok:false, motivo:"A la copia le falta la lista de fotos." };

  for (const [k, v] of Object.entries(c.local))
    if (typeof v !== "string")
      return { ok:false, motivo:`El bloque «${k}» de la copia está corrupto.` };

  if ("viajes_propios" in c.local){
    let v; try { v = JSON.parse(c.local.viajes_propios); } catch { v = null; }
    if (!Array.isArray(v)) return { ok:false, motivo:"La lista de viajes de la copia está corrupta." };
    if (v.some(x => !x || typeof x !== "object" || !x.id))
      return { ok:false, motivo:"Hay viajes sin identificador en la copia." };
  }

  for (const f of c.fotos)
    if (!f || typeof f !== "object" || typeof f.id !== "string" || typeof f.datos !== "string")
      return { ok:false, motivo:"Hay fotos sin identificador o sin contenido: la copia está incompleta." };

  return { ok:true, copia:c };
}

/* ---- Preparar la fusión ----
   Calcula TODO lo que habría que escribir, y no escribe nada. La regla
   es conservadora: lo que ya está en este móvil no se pierde nunca.

     · viajes   — se añaden los que no están. Si está en los dos, gana
                  el de `actualizado` más reciente; si empatan, el de aquí.
     · lápidas  — se suman, pero una lápida de la copia se descarta si
                  ese viaje está vivo aquí: borrar algo que existe por lo
                  que diga un archivo viejo sería destruir datos.
     · viajes de la copia con lápida aquí — NO vuelven.
     · diario   — se funde con `DIARIO_SYNC.fundir`, que ya es lo que usa
                  la sincronización entre dos móviles.
     · fotos    — se añaden solo las que no están. Repetir la misma copia
                  no duplica nada.
     · ajustes  — solo se rellenan los que aquí no existen. Lo que hayas
                  tocado en este móvil manda. */
async function preparaRestauracion(copia){
  const yaEstan = await FOTOS.todas();
  if (yaEstan === null)
    return { error:"No se han podido leer las fotos que ya hay en este móvil. No se ha cambiado nada." };

  const deLaCopia = copia.local || {};
  const claves = {};

  const viajesAqui = listaDe(leeClave("viajes_propios"));
  const viajesCopia = listaDe(deLaCopia.viajes_propios);
  const lapidasAqui = listaDe(leeClave("viajes_borrados")).filter(x => typeof x === "string");
  const lapidasCopia = listaDe(deLaCopia.viajes_borrados).filter(x => typeof x === "string");

  const enterrado = new Set(lapidasAqui);
  const porId = new Map(viajesAqui.filter(v => v && v.id).map(v => [v.id, v]));
  let anadidos = 0, actualizados = 0, resucitados = 0;

  for (const v of viajesCopia){
    if (!v || !v.id) continue;
    if (enterrado.has(v.id)){ resucitados++; continue; }   // borrado aquí: no vuelve
    const mio = porId.get(v.id);
    if (!mio){ porId.set(v.id, v); anadidos++; continue; }
    if (String(v.actualizado || "") > String(mio.actualizado || "")){
      porId.set(v.id, v); actualizados++;
    }
  }
  const viajesFinal = [...porId.values()];
  claves.viajes_propios = JSON.stringify(viajesFinal);

  const vivos = new Set(viajesFinal.map(v => v.id));
  const vivosAqui = new Set(viajesAqui.filter(v => v && v.id).map(v => v.id));
  claves.viajes_borrados = JSON.stringify(
    [...new Set([...lapidasAqui, ...lapidasCopia.filter(id => !vivosAqui.has(id))])]);

  const enterradoFinal = new Set(leeJSON(claves.viajes_borrados, []));
  claves.viajes_pendientes = JSON.stringify([...new Set([
    ...listaDe(leeClave("viajes_pendientes")),
    ...listaDe(deLaCopia.viajes_pendientes)
  ])].filter(id => vivos.has(id) && !enterradoFinal.has(id)));

  // Diario, viaje por viaje
  const conDiario = new Set([...viajesConDiario(), ...viajesFinal.map(v => v.id)]);
  for (const id of conDiario){
    const k = `diario_${id}`;
    if (!(k in deLaCopia)) continue;
    const dCopia = leeJSON(deLaCopia[k], null);
    if (!dCopia || typeof dCopia !== "object") continue;
    claves[k] = JSON.stringify(DIARIO_SYNC.fundir(DIARIO_SYNC.local(id), dCopia));
  }

  // El diario de reserva y los ajustes: solo lo que aquí no existe
  for (const k of ["eslo_hechas","eslo_notas","astu_hechas","astu_notas", ...COPIA_AJUSTES]){
    if (k in deLaCopia && leeClave(k) === null) claves[k] = deLaCopia[k];
  }
  for (const k of Object.keys(deLaCopia)){
    if (/^vp_.+_(hechas|notas)$/.test(k) && leeClave(k) === null) claves[k] = deLaCopia[k];
  }

  // Fotos y documentos: solo los que faltan
  const idsAqui = new Set(yaEstan.map(f => f.id));
  const fotosNuevas = (copia.fotos || []).filter(f => !idsAqui.has(f.id));
  const idsFinal = new Set([...idsAqui, ...fotosNuevas.map(f => f.id)]);
  claves.fotos_pendientes = JSON.stringify([...new Set([
    ...listaDe(leeClave("fotos_pendientes")),
    ...listaDe(deLaCopia.fotos_pendientes)
  ])].filter(id => idsFinal.has(id)));

  return { claves, fotosNuevas, resumen: {
    viajesNuevos: anadidos, viajesActualizados: actualizados,
    viajesQueSeQuedan: viajesFinal.length - anadidos,
    viajesNoResucitados: resucitados,
    fotosNuevas: fotosNuevas.filter(f => !f.doc).length,
    documentosNuevos: fotosNuevas.filter(f => f.doc).length,
    fotosQueYaEstaban: (copia.fotos || []).length - fotosNuevas.length,
    diariosFundidos: Object.keys(claves).filter(k => k.startsWith("diario_")).length
  } };
}

/* ---- Restaurar ----
   Orden a propósito: primero IndexedDB, que sí tiene transacciones de
   verdad, y después `localStorage`, que no las tiene y hay que deshacer
   a mano. Si algo se tuerce se dice, incluida la parte que no se haya
   podido devolver a su sitio. */
async function restauraCopia(texto){
  const v = validaCopia(texto);
  if (!v.ok) return { ok:false, motivo:v.motivo };

  const plan = await preparaRestauracion(v.copia);
  if (plan.error) return { ok:false, motivo:plan.error };

  if (plan.fotosNuevas.length){
    const metidas = await FOTOS.meterVarias(plan.fotosNuevas);
    if (metidas === null)
      return { ok:false, motivo:"No se han podido guardar las fotos de la copia. No se ha cambiado nada." };
  }

  const antes = {};
  for (const k of Object.keys(plan.claves)) antes[k] = leeClave(k);

  const escritas = [];
  try {
    for (const [k, val] of Object.entries(plan.claves)){ localStorage.setItem(k, val); escritas.push(k); }
  } catch (e) {
    let deshecho = true;
    for (const k of escritas){
      try { antes[k] === null ? localStorage.removeItem(k) : localStorage.setItem(k, antes[k]); }
      catch { deshecho = false; }
    }
    const fotosFuera = await FOTOS.quitarVarias(plan.fotosNuevas.map(f => f.id));
    return { ok:false, revertido: deshecho && fotosFuera,
      motivo: deshecho && fotosFuera
        ? `No se pudo escribir «${escritas.length ? escritas[escritas.length-1] : "?"}»: ${e && e.message ? e.message : "el móvil no dejó guardar"}. Se ha dejado todo como estaba.`
        : `No se pudo escribir y tampoco se ha podido deshacer del todo. Se escribieron ${escritas.length} bloques${fotosFuera ? "" : " y quedaron fotos metidas"}. Haz una copia ahora mismo antes de tocar nada más.` };
  }

  return { ok:true, ...plan.resumen };
}
