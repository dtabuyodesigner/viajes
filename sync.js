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
        const { error } = await c.from("viajes").upsert({ ...fila, extra: loDemas(viaje) });
        if (!error){ this.limpiarPendiente(viaje.id); return true; }
        // Solo si el error dice que la columna no está se reintenta sin ella.
        // Cualquier otro fallo se trata como fallo: queda pendiente y se
        // vuelve a intentar entero más tarde, con `extra` incluida.
        if (!esColumnaExtraAusente(error)) throw error;
        this.hayExtra = false;
      }
      const { error } = await c.from("viajes").upsert(fila);
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
      const { error } = await c.from("viajes")
        .update({ borrado:true, actualizado:new Date().toISOString() }).eq("id", id);
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
      const { data, error } = await c.from("viajes").select("*");
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
      const { error } = await c.from("viaje_diario").upsert({
        viaje, hechas:d.hechas, desmarcadas:d.desmarcadas, notas:d.notas,
        posiciones:d.posiciones, visitas:d.visitas, pernoctas:d.pernoctas, portadas:d.portadas,
        actualizado: new Date().toISOString()
      });
      return !error;
    } catch { return false; }
  },

  /* Baja lo del otro móvil, lo funde y devuelve si algo cambió */
  async sincronizar(viaje){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return { ok:false, cambios:false };
    let remoto = null;
    try {
      const { data, error } = await c.from("viaje_diario")
        .select("*").eq("viaje", viaje).maybeSingle();
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
      const { error } = await c.from("viaje_fotos").upsert({
        id: f.id, viaje: f.viaje, dia: f.dia, datos: f.datos,
        autor: SYNC.sesion.user?.email || "", borrada: false
      });
      if (error) throw error;
      this._quitarPendiente(id);
      return true;
    } catch { this._apuntarPendiente(id); return false; }
  },

  async marcarBorradaFuera(id){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return false;
    try {
      await c.from("viaje_fotos").update({ borrada:true }).eq("id", id);
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
      const { data, error } = await c.from("viaje_fotos")
        .select("id,borrada").eq("viaje", viaje).eq("dia", dia);
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
        const { data, error } = await c.from("viaje_fotos")
          .select("id,viaje,dia,datos,cuando").eq("id", f.id).maybeSingle();
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
