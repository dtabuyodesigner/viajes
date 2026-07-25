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
        await new Promise((ok, mal) => {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
          s.onload = ok; s.onerror = mal;
          document.head.appendChild(s);
          setTimeout(mal, 8000);
        });
      }
      this.cliente = window.supabase.createClient(SB_URL, SB_KEY);
      const { data } = await this.cliente.auth.getSession();
      this.sesion = data?.session || null;
      return this.cliente;
    } catch {
      this.cliente = null;
      return null;
    }
  },

  /* ---- Estado, para pintarlo en pantalla ---- */
  async estado(){
    if (!navigator.onLine) return { ok:false, txt:"Sin conexión · solo en este móvil" };
    const c = await this.conectar();
    if (!c) return { ok:false, txt:"No se pudo conectar · solo en este móvil" };
    if (!this.sesion) return { ok:false, txt:"Sin sesión · entra en Gastos compartidos para sincronizar", login:true };
    const p = this.pendientes().length;
    return { ok:true, txt: p ? `${p} viaje${p===1?"":"s"} por subir` : "Sincronizado", sesion:this.sesion };
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

// Reintento automático al recuperar la cobertura
window.addEventListener("online", () => { SYNC.sincronizar().catch(()=>{}); });
