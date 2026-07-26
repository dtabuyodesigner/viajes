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

/* Ninguna espera es infinita: si no responde, se avisa */
function conTope(promesa, ms, fallo){
  return Promise.race([
    promesa,
    new Promise(r => setTimeout(() => r(fallo), ms))
  ]);
}

const SYNC = {
  cliente: null,
  sesion: null,

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

  /* ---- Subir un viaje ---- */
  async subir(viaje){
    const c = await this.conectar();
    if (!c || !this.sesion){ this.marcarPendiente(viaje.id); return false; }
    try {
      const { error } = await c.from("viajes").upsert({
        id: viaje.id, nombre: viaje.nombre, desde: viaje.desde || "",
        hasta: viaje.hasta || "", salida: viaje.salida || "",
        dias: viaje.dias || [], autor: this.sesion.user?.email || "",
        actualizado: new Date().toISOString(), borrado: false
      });
      if (error) throw error;
      this.limpiarPendiente(viaje.id);
      return true;
    } catch {
      this.marcarPendiente(viaje.id);
      return false;
    }
  },

  /* ---- Marcar como borrado (para que desaparezca del otro móvil) ---- */
  async borrar(id){
    const c = await this.conectar();
    if (!c || !this.sesion) return false;
    try {
      await c.from("viajes").update({ borrado:true, actualizado:new Date().toISOString() }).eq("id", id);
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

    // primero, lo que quedó pendiente de subir
    const locales = this.locales();
    for (const id of this.pendientes()){
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
        continue;
      }
      const nube = { id:r.id, nombre:r.nombre, desde:r.desde||"", hasta:r.hasta||"",
                     salida:r.salida||"", dias:r.dias||[], actualizado:r.actualizado };
      if (!l){ porId.set(r.id, nube); cambios++; continue; }
      // gana el más reciente
      const tl = Date.parse(l.actualizado || 0) || 0;
      const tr = Date.parse(r.actualizado || 0) || 0;
      if (tr > tl){ porId.set(r.id, nube); cambios++; }
      else if (tl > tr){ await this.subir(l); }
    }

    // lo que existe solo en el móvil, sube
    for (const l of locales){
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
    try { return JSON.parse(localStorage.getItem(this.clave(viaje)))
      || { hechas:{}, desmarcadas:{}, notas:{} }; }
    catch { return { hechas:{}, desmarcadas:{}, notas:{} }; }
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
    return r;
  },

  async subir(viaje){
    const c = await SYNC.conectar();
    if (!c || !SYNC.sesion) return false;
    const d = this.local(viaje);
    try {
      const { error } = await c.from("viaje_diario").upsert({
        viaje, hechas:d.hechas, desmarcadas:d.desmarcadas, notas:d.notas,
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
      hechas: remoto.hechas || {}, desmarcadas: remoto.desmarcadas || {}, notas: remoto.notas || {}
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

   Se guardan en el móvil. No se sincronizan todavía: una foto
   comprimida son 100 KB y meterlas en la fila del viaje sería
   pesado. Para compartirlas, de momento, el compartir del móvil.
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
  async guardar(viaje, dia, datos){
    const t = await this._tienda("readwrite");
    if (!t) return null;
    const id = `${viaje}:${dia}:${Date.now()}`;
    return new Promise(ok => {
      const p = t.put({ id, viaje, dia, datos, cuando: Date.now() });
      p.onsuccess = () => ok(id);
      p.onerror = () => ok(null);
    });
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
        if (c.value.viaje === viaje && String(c.value.dia) === String(dia)) fuera.push(c.value);
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
        if (c.value.viaje === viaje) n[c.value.dia] = (n[c.value.dia] || 0) + 1;
        c.continue();
      };
      p.onerror = () => ok({});
    });
  },

  async borrar(id){
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
window.addEventListener("online", () => { SYNC.sincronizar().catch(()=>{}); });
