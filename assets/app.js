/* ═══════════════════════════════════════════════════════════
   Motor común de las apps de viaje.

   Aquí vive lo que es idéntico en Eslovenia, Asturias y el
   visor de viajes creados. Cada app aporta sus datos y sus
   piezas propias; esto es lo compartido.

   Depende de que la app defina antes: VIAJE, VIAJE_ID, esc() y
   navegarXY(). Como solo se usan al llamar a las funciones, no
   importa el orden de carga.

   Este archivo se pide SIN ?v=: la versión la lleva el service
   worker. Al tocarlo hay que subir el CACHE de los sw.js que lo
   guardan (viaje, eslovenia, asturias) o el móvil seguirá con la
   versión antigua.
   ═══════════════════════════════════════════════════════════ */

/* ---- Tiempo real por carretera (OSRM, datos de OpenStreetMap) ---- */
function formatoTiempo(seg){
  const m = Math.round(seg / 60);
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}

async function porCarretera(origen, destinos, opciones = {}){
  // `senal` deja que la búsqueda entera se cancele de golpe; `ms` que el
  // tope venga de fuera, para que las pruebas no tarden doce segundos.
  const { ms = 12000, senal = null } = opciones;
  if (!navigator.onLine || !destinos.length) return null;
  if (senal && senal.aborted) return null;
  const puntos = [origen, ...destinos].map(p => `${p[1]},${p[0]}`).join(";");
  const url = `https://router.project-osrm.org/table/v1/driving/${puntos}` +
              `?sources=0&annotations=duration,distance`;
  const ctrl = new AbortController();
  const contagia = () => { try { ctrl.abort(); } catch {} };
  if (senal) senal.addEventListener("abort", contagia, { once:true });
  const corte = setTimeout(contagia, ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(corte);
    if (!r.ok) throw new Error(r.status);
    const d = await r.json();
    if (d.code !== "Ok") throw new Error(d.code);
    const dur = (d.durations || [[]])[0].slice(1);
    const dis = (d.distances || [[]])[0].slice(1);
    return destinos.map((_, i) => (dur[i] == null ? null : {
      seg: dur[i], km: dis[i] != null ? dis[i] / 1000 : null
    }));
  } catch { clearTimeout(corte); return null; }
}

/* ---- «Estoy aquí»: registrar un sitio, esté o no en el plan ---- */
function cajaAqui(i, ctx = "hoy"){
  return `<div class="aqui-zona" id="aqui-${ctx}-${i}">
    <span class="label">Por dónde hemos pasado</span>
    <div id="lista-aqui-${ctx}-${i}"></div>
    <div class="btns">
      <button class="btn solid" data-aqui="${ctx}:${i}">Estoy aquí</button>
      <button class="btn" data-buscar-sitio="${ctx}:${i}">Añadir un sitio</button>
    </div>
    <div id="buscar-sitio-${ctx}-${i}"></div>
    <p class="note">Guarda el punto donde estés ahora, aunque no estuviera previsto. Luego sale en el mapa.</p>
  </div>`;
}

function pintaAqui(i, ctx = "hoy"){
  const z = document.getElementById(`lista-aqui-${ctx}-${i}`);
  if (!z || typeof DIARIO_SYNC === "undefined") return;
  const vs = DIARIO_SYNC.visitasDelDia(VIAJE_ID, i);
  z.innerHTML = vs.length ? `<ul class="plain">${vs.map(v => {
    const h = new Date(v.ts);
    const hora = `${String(h.getHours()).padStart(2,"0")}:${String(h.getMinutes()).padStart(2,"0")}`;
    const busca = (v.txt || "").trim()
      ? `https://www.google.com/search?q=${encodeURIComponent(v.txt)}`
      : `https://www.google.com/maps/search/?api=1&query=${v.xy}`;
    return `<li class="visita">
      <div>
        <a class="visita-nom" href="${busca}" target="_blank" rel="noopener">${
          esc(v.txt) || "Buscando el nombre…"}</a>
        <small>${v.manual ? "añadido a mano" : hora}${v.auto ? " · según OpenStreetMap" : ""}${
          v.precision ? ` · ±${v.precision} m` : ""}</small>
      </div>
      <div class="btns" style="margin-top:6px">
        <a class="btn fino" href="${mapaXY(...comoPar(v.xy))}" target="_blank" rel="noopener">Ver en el mapa</a>
        <a class="btn fino" href="${navegarXY(...comoPar(v.xy))}" target="_blank" rel="noopener">Volver</a>
        <button class="btn fino" data-nombrar="${v.id}">${v.txt ? "Renombrar" : "Ponerle nombre"}</button>
        <button class="btn fino borrar-v" data-quitar-v="${v.id}">Quitar</button>
      </div>
    </li>`; }).join("")}</ul>` : "";

  z.querySelectorAll("[data-nombrar]").forEach(b => b.addEventListener("click", () => {
    const v = DIARIO_SYNC.visitasDelDia(VIAJE_ID, i).find(x => x.id === b.dataset.nombrar);
    const t = prompt("¿Qué es este sitio?", v?.txt || "");
    if (t === null) return;
    DIARIO_SYNC.renombrarVisita(VIAJE_ID, b.dataset.nombrar, t.trim());
    pintaAqui(i, ctx);
  }));
  z.querySelectorAll("[data-quitar-v]").forEach(b => b.addEventListener("click", () => {
    if (!confirm("¿Quitar este punto?")) return;
    DIARIO_SYNC.borrarVisita(VIAJE_ID, b.dataset.quitarV);
    pintaAqui(i, ctx);
    refrescaMapaCab(i, ctx);
  }));
}

function activaBuscarSitio(i, ctx = "hoy"){
  const b = document.querySelector(`[data-buscar-sitio="${ctx}:${i}"]`);
  if (!b || b.dataset.listo) return;
  b.dataset.listo = "1";
  b.addEventListener("click", () => {
    const z = document.getElementById(`buscar-sitio-${ctx}-${i}`);
    if (z.dataset.abierto){ z.innerHTML = ""; delete z.dataset.abierto; return; }
    z.dataset.abierto = "1";
    z.innerHTML = `<div class="busca-sitio">
      <input type="text" id="qs-${ctx}-${i}" placeholder="Škofja Loka, un bar, un mirador…">
      <div class="btns"><button class="btn fino solid" id="gos-${ctx}-${i}">Buscar</button></div>
      <div id="rs-sitio-${ctx}-${i}"></div>
    </div>`;

    const lanzar = async () => {
      const q = document.getElementById(`qs-${ctx}-${i}`).value.trim();
      if (!q) return;
      const rs = document.getElementById(`rs-sitio-${ctx}-${i}`);
      rs.innerHTML = `<p class="note">Buscando…</p>`;
      const cerca = VIAJE.dias[i]?.xy || "";
      const res = await DIARIO_SYNC.buscarSitio(q, cerca);
      if (!res.length){ rs.innerHTML = `<p class="note">Nada con ese nombre. ¿Hay cobertura?</p>`; return; }
      rs.innerHTML = `<ul class="plain">${res.map((r, k) => `
        <li class="res-sitio">
          <div><b>${esc(r.nombre)}</b><small>${esc(r.donde)}</small></div>
          <button class="btn fino solid" data-anadir="${k}">Añadir</button>
        </li>`).join("")}</ul>`;
      rs.dataset.res = JSON.stringify(res);
      rs.querySelectorAll("[data-anadir]").forEach(bt => bt.addEventListener("click", () => {
        const r = JSON.parse(rs.dataset.res)[+bt.dataset.anadir];
        DIARIO_SYNC.anadirVisita(VIAJE_ID, i, r.nombre, r.xy, VIAJE.dias[i]?.f || "");
        z.innerHTML = ""; delete z.dataset.abierto;
        pintaAqui(i, ctx);
        refrescaMapaCab(i, ctx);
      }));
    };
    document.getElementById(`gos-${ctx}-${i}`).addEventListener("click", lanzar);
    document.getElementById(`qs-${ctx}-${i}`).addEventListener("keydown", e => {
      if (e.key === "Enter"){ e.preventDefault(); lanzar(); } });
  });
}

function activaAqui(i, ctx = "hoy"){
  const b = document.querySelector(`[data-aqui="${ctx}:${i}"]`);
  if (!b || b.dataset.listo) return;
  b.dataset.listo = "1";
  b.addEventListener("click", () => trabajando(b, "Localizando…", async () => {
    // Sin desactivar el botón, dos toques guardaban dos visitas distintas
    await DIARIO_SYNC.apuntarAqui(VIAJE_ID, i, "");
    pintaAqui(i, ctx);
    refrescaMapaCab(i, ctx);
    // el nombre llega un momento después, de OpenStreetMap
    setTimeout(() => pintaAqui(i, ctx), 1500);
    setTimeout(() => pintaAqui(i, ctx), 4000);
  }, { exito:"Guardado", vuelve:2200 }));
}


/* ---- Dónde dormimos ---- */
const TIPOS_CAMA = [["furgo","En la furgo"],["camping","Camping"],
                    ["hotel","Hotel o casa"],["area","Área de autocaravanas"]];
const VALORES = [[3,"★ Repetiría"],[2,"Correcto"],[1,"No volvería"]];

function cajaPernocta(i, ctx = "hoy"){
  return `<div class="cama-zona" id="cama-${ctx}-${i}">
    <span class="label">Dónde dormimos</span>
    <div id="cama-lista-${ctx}-${i}"></div>
  </div>`;
}

function pintaPernocta(i, ctx = "hoy"){
  const z = document.getElementById(`cama-lista-${ctx}-${i}`);
  if (!z || typeof DIARIO_SYNC === "undefined") return;
  const p = DIARIO_SYNC.pernoctaDelDia(VIAJE_ID, i);

  if (!p){
    z.innerHTML = `<p class="note" style="margin:6px 0 10px">Guarda el sitio exacto donde pasáis la noche: para volver, o para acordaros de no volver.</p>
      <div class="btns"><button class="btn solid" data-dormir="${ctx}:${i}">Dormimos aquí</button></div>`;
  } else {
    const val = VALORES.find(v => v[0] === p.valorada);
    z.innerHTML = `<div class="cama-ficha">
      <div class="cama-cab">
        <div>
          <b>${esc(p.txt) || "Buscando el nombre…"}</b>
          <small>${p.tipo ? esc((TIPOS_CAMA.find(t => t[0] === p.tipo) || [,""])[1]) : ""}${
            p.auto && !p.tipo ? "según OpenStreetMap" : ""}</small>
        </div>
        ${val ? `<span class="cama-val v${p.valorada}">${esc(val[1])}</span>` : ""}
      </div>
      ${p.nota ? `<p class="cama-nota">${esc(p.nota)}</p>` : ""}
      <div class="tipos">${TIPOS_CAMA.map(([id, n]) =>
        `<button class="tipo${p.tipo === id ? " on" : ""}" data-tipo="${ctx}:${i}:${id}">${n}</button>`).join("")}</div>
      <div class="tipos">${VALORES.map(([v, n]) =>
        `<button class="tipo val${v}${p.valorada === v ? " on" : ""}" data-val="${ctx}:${i}:${v}">${n}</button>`).join("")}</div>
      <div class="btns">
        <a class="btn solid" href="${navegarXY(...comoPar(p.xy))}" target="_blank" rel="noopener">Volver aquí</a>
        <a class="btn" href="${mapaXY(...comoPar(p.xy))}" target="_blank" rel="noopener">Ver</a>
        <button class="btn" data-nota-cama="${ctx}:${i}">${p.nota ? "Cambiar nota" : "Apuntar algo"}</button>
        <button class="btn borrar-v" data-quitar-cama="${ctx}:${i}">Quitar</button>
      </div>
    </div>`;
  }
  enganchaPernocta(i, ctx);
}

function enganchaPernocta(i, ctx){
  const z = document.getElementById(`cama-lista-${ctx}-${i}`);
  if (!z) return;

  z.querySelectorAll(`[data-dormir]`).forEach(b =>
    b.addEventListener("click", () => trabajando(b, "Localizando…", async () => {
      // Igual que «Estoy aquí»: dos toques guardaban dos pernoctas
      await DIARIO_SYNC.apuntarPernocta(VIAJE_ID, i);
      pintaPernocta(i, ctx);
      setTimeout(() => pintaPernocta(i, ctx), 1600);
      setTimeout(() => pintaPernocta(i, ctx), 4000);
    })));

  const actual = () => DIARIO_SYNC.pernoctaDelDia(VIAJE_ID, i);

  z.querySelectorAll("[data-tipo]").forEach(b => b.addEventListener("click", () => {
    const tipo = b.dataset.tipo.split(":")[2];
    const p = actual(); if (!p) return;
    DIARIO_SYNC.editarPernocta(VIAJE_ID, p.id, { tipo: p.tipo === tipo ? "" : tipo });
    pintaPernocta(i, ctx);
  }));

  z.querySelectorAll("[data-val]").forEach(b => b.addEventListener("click", () => {
    const v = +b.dataset.val.split(":")[2];
    const p = actual(); if (!p) return;
    DIARIO_SYNC.editarPernocta(VIAJE_ID, p.id, { valorada: p.valorada === v ? 0 : v });
    pintaPernocta(i, ctx);
  }));

  z.querySelectorAll("[data-nota-cama]").forEach(b => b.addEventListener("click", () => {
    const p = actual(); if (!p) return;
    const t = prompt("¿Qué conviene recordar de este sitio?", p.nota || "");
    if (t === null) return;
    DIARIO_SYNC.editarPernocta(VIAJE_ID, p.id, { nota: t.trim() });
    pintaPernocta(i, ctx);
  }));

  z.querySelectorAll("[data-quitar-cama]").forEach(b => b.addEventListener("click", () => {
    const p = actual(); if (!p) return;
    if (!confirm("¿Quitar este sitio?")) return;
    DIARIO_SYNC.borrarPernocta(VIAJE_ID, p.id);
    pintaPernocta(i, ctx);
  }));

  z.querySelectorAll("[data-nombrar-cama]").forEach(b => b.addEventListener("click", () => {
    const p = actual(); if (!p) return;
    const t = prompt("¿Cómo se llama el sitio?", p.txt || "");
    if (t === null) return;
    DIARIO_SYNC.editarPernocta(VIAJE_ID, p.id, { txt: t.trim(), auto: false });
    pintaPernocta(i, ctx);
  }));
}



/* ---- Documentos: tarjetas de embarque y demás ----
   Se guardan en el propio móvil, no en la nube: son datos personales con
   nombre y código de barras. Menos comprimidos que las fotos, que aquí el
   código tiene que poder leerse en el lector del aeropuerto. */
function cajaDoc(clave, titulo, pista){
  return `<div class="doc-zona" id="doc-${clave}">
    <span class="label">${esc(titulo)}</span>
    <div id="doc-cuerpo-${clave}"></div>
  </div>`;
}

async function pintaDoc(clave, titulo, pista){
  const z = document.getElementById(`doc-cuerpo-${clave}`);
  if (!z) return;
  const ds = await FOTOS.docs(VIAJE_ID, clave);

  const botones = `<div class="btns">
      <label class="btn${ds.length ? "" : " solid"}" style="cursor:pointer">
        <input type="file" accept="image/*" multiple data-doc="${clave}" hidden>
        <span>${ds.length ? "Añadir otra" : "Añadir"}</span>
      </label>
      <label class="btn" style="cursor:pointer">
        <input type="file" accept="image/*" capture="environment" data-doc="${clave}" hidden>
        <span>Hacer foto</span>
      </label>
    </div>`;

  if (!ds.length){
    z.innerHTML = `<p class="note" style="margin:6px 0 10px">${esc(pista)}</p>${botones}`;
  } else {
    z.innerHTML = ds.map(d => `
      <div class="doc-una">
        <img class="doc-img" src="${d.datos}" alt="${esc(titulo)}" data-doc-grande="${esc(d.id)}">
        <div class="btns">
          <button class="btn solid" data-doc-grande="${esc(d.id)}">Ver a pantalla completa</button>
          <button class="btn borrar-v" data-doc-quitar="${esc(d.id)}">Quitar</button>
        </div>
      </div>`).join("")
      + botones
      + `<p class="note">${ds.length === 1 ? "Guardada" : ds.length + " guardadas"} en este móvil. Se ven sin cobertura.</p>`;
  }
  enganchaDoc(clave, titulo, pista);
}

function enganchaDoc(clave, titulo, pista){
  const z = document.getElementById(`doc-cuerpo-${clave}`);
  if (!z) return;

  z.querySelectorAll(`[data-doc="${clave}"]`).forEach(inp => {
    if (inp.dataset.listo) return; inp.dataset.listo = "1";
    // Una tanda cada vez, igual que en la cámara: dos selecciones seguidas
    // guardaban el mismo documento dos veces.
    let procesando = false;
    inp.addEventListener("change", async e => {
      const archivos = [...(e.target.files || [])];
      if (!archivos.length) return;      // canceló el selector: nada que bloquear
      if (procesando) return;
      procesando = true;

      const control = inp.parentElement;
      const eti = control ? control.querySelector("span") : null;
      const antes = eti ? eti.textContent : "";
      if (eti) eti.textContent = archivos.length > 1 ? `Guardando ${archivos.length}…` : "Guardando…";
      if (control) control.setAttribute("aria-busy", "true");

      let fallos = 0;
      try {
        for (const f of archivos){
          try {
            // poca compresión: el código de barras tiene que poder leerse
            const datos = await comprimirFoto(f, 1800, 0.92);
            const id = await FOTOS.guardarDoc(VIAJE_ID, clave, datos, f.name);
            if (!id) fallos++;
          } catch { fallos++; }
        }
      } finally {
        procesando = false;
        if (eti) eti.textContent = antes;
        if (control) control.removeAttribute("aria-busy");
        inp.value = "";
      }

      if (fallos) alert(fallos === archivos.length
        ? "No se pudo guardar. ¿Queda sitio en el móvil?"
        : `${fallos} de ${archivos.length} no se pudieron guardar.`);
      pintaDoc(clave, titulo, pista);
    });
  });

  z.querySelectorAll("[data-doc-grande]").forEach(b => b.addEventListener("click", async () => {
    const ds = await FOTOS.docs(VIAJE_ID, clave);
    const d = ds.find(x => x.id === b.dataset.docGrande);
    if (d) verDocGrande(d.datos, ds.map(x => x.datos), ds.indexOf(d));
  }));

  z.querySelectorAll("[data-doc-quitar]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("¿Quitar este documento del móvil?")) return;
    await FOTOS.borrarDoc(VIAJE_ID, b.dataset.docQuitar);
    pintaDoc(clave, titulo, pista);
  }));
}


/* A pantalla completa y con el brillo al máximo: los lectores del aeropuerto
   necesitan contraste, y con la pantalla a media luz no leen el código. */
function verDocGrande(src, todas, desde){
  const lista = (todas && todas.length) ? todas : [src];
  let n = Math.max(0, desde || 0);
  const v = document.createElement("div");
  v.className = "doc-visor";
  const pinta = () => {
    v.innerHTML = `<img src="${lista[n]}" alt="">
      ${lista.length > 1 ? `<div class="doc-pasar">
        <button class="paso" data-ir="-1">‹</button>
        <span>${n + 1} de ${lista.length}</span>
        <button class="paso" data-ir="1">›</button>
      </div>` : ""}
      <button class="cerrar">Cerrar</button>`;
    v.querySelectorAll("[data-ir]").forEach(b => b.addEventListener("click", ev => {
      ev.stopPropagation();
      n = (n + Number(b.dataset.ir) + lista.length) % lista.length;
      pinta();
    }));
    v.querySelector(".cerrar").addEventListener("click", () => v.remove());
  };
  pinta();
  v.addEventListener("click", e => { if (e.target === v) v.remove(); });
  document.body.appendChild(v);
}

/* ---- El alojamiento del día ---- */
function bloqueHotel(d){
  const nombre = (d.hotel || d.dest || "").trim();
  if (!nombre) return "";
  const donde = (d.dest && d.dest !== nombre) ? `${nombre} ${d.dest}` : nombre;
  const q = encodeURIComponent(donde);

  // Los enlaces los construye la app: pedírselos a una IA sale mal, se los inventa
  return `<div class="hotel-zona">
    <span class="label">Dónde dormís</span>
    <div class="card" style="margin-top:8px">
      <h3>${esc(nombre)}</h3>
      <div class="btns">
        <a class="btn solid" href="${navegar(donde)}" target="_blank" rel="noopener">Ir con ${comoNavego()}</a>
        <a class="btn" href="${mapa(donde)}" target="_blank" rel="noopener">Ver</a>
      </div>
      <div class="btns">
        ${d.hotelWeb ? `<a class="btn solid" href="${esc(d.hotelWeb)}" target="_blank" rel="noopener">Su web</a>` : ""}
        <a class="btn" target="_blank" rel="noopener"
           href="https://www.google.com/search?q=${encodeURIComponent(donde + " hotel")}">Ficha y fotos</a>
      </div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════
   Buscar sin que la espera se vaya de las manos.

   Antes, una búsqueda podía tener a la persona esperando hasta
   noventa segundos sin poder hacer nada: diez de GPS, sesenta y
   ocho encadenando tres servidores de mapas, y doce más de
   tiempos por carretera. Sin cobertura no pasaba —fetch falla al
   instante— pero con cobertura débil de montaña sí, que es justo
   donde se usa esto.

   Ahora hay UN plazo desde el toque, no uno por fase. Quien
   busca no distingue GPS de servidor de mapas: solo ve que no
   puede hacer nada. Cambiar de servidor no reinicia la espera:
   cada intento se queda con lo que quede.

   Y se puede cancelar. El GPS no admite cancelación —la API no
   la tiene— así que su respuesta se tira si llega tarde, en vez
   de repintar una pantalla que la persona ya ha abandonado.
   ═══════════════════════════════════════════════════════════ */

const PRESUPUESTO_BUSQUEDA = 30000;   // GPS + mapas, hasta los primeros resultados
const TOPE_GPS  = 8000;               // localizar no puede comerse el plazo
const TOPE_RUTA = 8000;               // los tiempos por carretera van aparte

/* La búsqueda en marcha, y su generación.

   La generación hace falta además del AbortController porque hay cosas
   que no se pueden abortar: el GPS no tiene cancelación, y una respuesta
   vieja de Overpass o de OSRM puede llegar cuando la persona ya ha
   pedido otra categoría. Comparando la generación se sabe si lo que
   acaba de llegar sigue valiendo o hay que tirarlo. */
let BUSQUEDA = null;
let GENERACION = 0;

function hayBusqueda(){ return !!BUSQUEDA; }
function generacionBusqueda(){ return GENERACION; }

/* Reemplazar no es cancelar. Si la búsqueda vieja se marcara como
   cancelada, su orquestador pintaría «Búsqueda cancelada» encima de los
   resultados de la nueva. Al reemplazar se calla; al cancelar, avisa. */
function invalidaBusqueda(){
  if (!BUSQUEDA) return false;
  try { BUSQUEDA.maestro.abort(); } catch {}
  BUSQUEDA = null;
  GENERACION++;                  // nada de la generación vieja repinta
  return true;
}

function cancelaBusqueda(){
  if (!BUSQUEDA) return false;
  BUSQUEDA.cancelada = true;     // lo pidió la persona
  return invalidaBusqueda();
}

/* Abre una operación con su plazo. Cancela la anterior: cada cambio de
   categoría, radio o modalidad manda sobre lo que hubiera en vuelo. */
function abreBusqueda(presupuesto = PRESUPUESTO_BUSQUEDA){
  invalidaBusqueda();
  const gen = ++GENERACION;
  const op = {
    gen,
    maestro: new AbortController(),
    cancelada: false,
    fin: Date.now() + presupuesto,
    queda(){ return this.fin - Date.now(); },
    viva(){ return this.gen === GENERACION && !this.cancelada; }
  };
  BUSQUEDA = op;
  return op;
}

function cierraBusqueda(op){ if (BUSQUEDA === op) BUSQUEDA = null; }

/* Dónde estamos, sin comerse el plazo.

   El GPS no se puede abortar: la API no lo permite. Así que si cancelan
   mientras tanto, su respuesta se descarta — ni se guarda la posición ni
   se repinta nada. */
async function ubicacionDeBusqueda(op){
  if (!op || !op.viva()) return null;
  const ms = Math.min(TOPE_GPS, op.queda());
  if (ms <= 300) return null;

  const p = await new Promise(ok => {
    if (!navigator.geolocation) return ok(null);
    let hecho = false;
    const cierra = v => {
      if (hecho) return;
      hecho = true;
      clearTimeout(corte);
      op.maestro.signal.removeEventListener("abort", corta);
      ok(v);
    };
    // Si cancelan, se deja de esperar AHORA. El GPS sigue por dentro —no se
    // puede abortar— pero su respuesta ya no le importa a nadie, y los
    // botones vuelven en el acto en vez de al cabo de ocho segundos.
    const corta = () => cierra(null);
    const corte = setTimeout(corta, ms);
    op.maestro.signal.addEventListener("abort", corta, { once:true });
    navigator.geolocation.getCurrentPosition(
      pos => cierra([pos.coords.latitude, pos.coords.longitude]),
      () => cierra(null),
      { enableHighAccuracy:true, timeout:ms, maximumAge:30000 });
  });

  if (!op.viva()) return null;          // llegó tarde: se tira
  if (p){ try { if (typeof guardaPosicion === "function") guardaPosicion(p); } catch {} }
  return p;
}

/* Recorre los intentos sin pasarse del plazo.

   `pide(n, senal)` hace la petición del intento n con esa señal y
   devuelve { listo:true, valor } si hay resultado, { vacia:true } si el
   servidor respondió y de verdad no hay nada, o { motivo } si falló.

   Devuelve un estado, nunca lanza:
     bien · vacia · cancelada · tarde · fallaron · reemplazada */
async function conPresupuesto(op, intentos, pide, opciones = {}){
  const { alProbar = null } = opciones;
  let ultimo = "";
  const fuera = () => ({ estado: op.cancelada ? "cancelada" : "reemplazada" });

  for (let n = 0; n < intentos.length; n++){
    if (!op.viva()) return fuera();

    const queda = op.queda();
    if (queda <= 300) return { estado:"tarde", motivo:ultimo };

    if (alProbar) { try { alProbar(n, intentos.length); } catch {} }

    const propio = new AbortController();
    const contagia = () => { try { propio.abort(); } catch {} };
    op.maestro.signal.addEventListener("abort", contagia, { once:true });
    const corte = setTimeout(contagia, Math.min(intentos[n].ms, queda));

    try {
      const r = await pide(n, propio.signal);
      if (!op.viva()) return fuera();
      if (r && r.listo) return { estado:"bien", valor:r.valor };
      if (r && r.vacia) return { estado:"vacia" };
      if (r && r.motivo) ultimo = r.motivo;
    } catch (e){
      if (!op.viva()) return fuera();
      ultimo = /abort/i.test(String((e && e.name) || e)) ? "lento"
             : String((e && e.message) || e);
    } finally {
      clearTimeout(corte);
      op.maestro.signal.removeEventListener("abort", contagia);
    }
  }
  return { estado:"fallaron", motivo:ultimo };
}

/* Los tiempos por carretera: mejora, no requisito.

   Va con su propio límite corto, fuera del plazo principal, porque para
   cuando se llama los resultados ya están en pantalla y ya sirven. Si
   falla, si lo cancelan o si tarda, los resultados se quedan como están
   y solo cambia la nota de abajo. Nunca sustituye resultados válidos por
   un mensaje de error. */
async function porCarreteraDeBusqueda(op, origen, destinos){
  if (!op || !op.viva()) return null;
  try {
    const t = await porCarretera(origen, destinos, { ms: TOPE_RUTA, senal: op.maestro.signal });
    return op.viva() ? t : null;        // llegó tarde, ya hay otra búsqueda
  } catch { return null; }
}

/* Lo que se le dice a la persona. Cancelar no es un fallo: fue decisión
   suya, y el texto no puede sonar a que algo se ha roto. Y no se dice
   cuántos servidores se probaron, porque no son los mismos en todas las
   apps: el visor consulta uno solo. */
function textoDeBusqueda(r, contexto = {}){
  const { km = "", modo = "" } = contexto;
  if (r.estado === "cancelada")
    return "Búsqueda cancelada. Puedes intentarlo otra vez cuando quieras.";
  if (r.estado === "tarde")
    return "Los servidores de mapas no han respondido a tiempo. Prueba en un momento.";
  if (r.estado === "vacia")
    return `Nada en ${km} km. Prueba a ampliar el radio.`;
  if (!navigator.onLine)
    return "Sin cobertura. Esto necesita red.";
  const m = String(r.motivo || "");
  if (m === "ocupado")
    return "El servidor de mapas está saturado ahora mismo. Prueba en un minuto.";
  if (m === "lento" || /abort/i.test(m))
    return `El servidor de mapas va lento ahora mismo. ${+km > 25
      ? "Prueba con un radio menor" : "Vuelve a intentarlo en un momento"}.`;
  if (m) return `No se pudo consultar${modo === "ruta" ? " por el camino" : ""}.`;
  return "Los servidores de mapas no responden ahora. Prueba en un momento.";
}

/* La línea de progreso con su botón de cancelar. El botón va aparte de
   los chips de categoría para que un toque en marcha no lo confunda con
   relanzar la búsqueda. */
function pintaBuscando(cont, texto){
  if (!cont) return;
  cont.innerHTML =
    `<p class="note" id="busca-txt" aria-live="polite">${esc(texto)}</p>
     <div class="btns"><button class="btn parar" id="busca-cancelar"
       aria-label="Cancelar la búsqueda">Cancelar</button></div>`;
  const b = document.getElementById("busca-cancelar");
  if (b) b.addEventListener("click", () => {
    b.disabled = true;
    b.textContent = "Cancelando…";
    cancelaBusqueda();
  });
}

/* El final de una búsqueda que no trajo resultados. Cancelar no lleva
   botón de «ver por qué»: no hubo ningún fallo que explicar. */
function pintaFinBusqueda(cont, op, r, contexto = {}){
  if (!cont) return;
  const texto = textoDeBusqueda(r, contexto);
  const conDetalle = r.estado === "fallaron" && typeof ULTIMO_FALLO !== "undefined" && ULTIMO_FALLO;
  cont.innerHTML = `<p class="note" aria-live="polite">${esc(texto)}` +
    (conDetalle ? ` <button class="lnk" id="ver-motivo">ver por qué</button>` : "") +
    `</p><div id="detalle-fallo"></div>`;
}

function progresoBusqueda(texto){
  const t = document.getElementById("busca-txt");
  if (t) t.textContent = texto;
}

/* ---- Qué ver por aquí: lo que merece la pena alrededor ---- */
const QUE_VER = [
  { id:"mirador", n:"Miradores",  q:'node["tourism"="viewpoint"]' },
  { id:"monum",   n:"Monumentos", q:'node["historic"];way["historic"];node["tourism"="attraction"];way["tourism"="attraction"]' },
  { id:"museo",   n:"Museos",     q:'node["tourism"="museum"];way["tourism"="museum"]' },
  { id:"natura",  n:"Naturaleza", q:'node["natural"="peak"];node["waterway"="waterfall"];node["natural"="cave_entrance"];way["natural"="beach"]' },
  { id:"iglesia", n:"Iglesias",   q:'way["building"="church"];way["building"="cathedral"];node["amenity"="place_of_worship"]' },
  { id:"paseo",   n:"Plazas y paseos", q:'node["place"="square"];way["place"="square"];way["leisure"="park"]' }
];

/* Un sitio sin nombre no vale para «qué ver»: sería un punto anónimo */
function meritoDe(e){
  const t = e.tags || {};
  if (!t.name) return 0;
  let m = 1;
  if (t.wikipedia || t.wikidata) m += 3;      // si tiene artículo, algo tendrá
  if (t.heritage || t.historic) m += 2;
  if (t.tourism === "attraction" || t.tourism === "museum") m += 2;
  if (t.description || t["description:es"]) m += 1;
  if (t.website || t.opening_hours) m += 1;
  return m;
}

async function queVerCerca(cat, pos, km, op, alProbar){
  const SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  const intentos = [ {tope:60, espera:25}, {tope:30, espera:15}, {tope:15, espera:10} ]
    .map(x => ({ ...x, ms: (x.espera + 6) * 1000 }));

  return conPresupuesto(op, intentos, async (n, senal) => {
    const { tope, espera } = intentos[n];
    const partes = cat.q.split(";").map(t => `${t}(around:${km*1000},${pos[0]},${pos[1]});`).join("");
    const consulta = `[out:json][timeout:${espera}];(${partes});out center ${tope};`;
    {
      const r = await fetch(SERVIDORES[n % SERVIDORES.length] + "?data=" + encodeURIComponent(consulta),
                            { signal: senal });
      if (!r.ok){
        return { motivo: r.status === 429 ? "ocupado" : r.status === 504 ? "lento" : String(r.status) };
      }
      const d = await r.json();
      const sitios = (d.elements || []).map(e => {
        const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
        const merito = meritoDe(e);
        if (la == null || !merito) return null;
        const t = e.tags;
        return {
          nombre: t.name,
          detalle: t["description:es"] || t.description ||
                   (t.historic ? "Lugar histórico" : "") ||
                   (t.tourism === "museum" ? "Museo" : ""),
          wiki: t.wikipedia || "",
          xy:[la, lo], km: distancia(pos, [la, lo]), merito
        };
      }).filter(Boolean);

      // sin repetir nombres, lo más interesante primero y a igualdad, lo más cerca
      const vistos = new Set();
      const unicos = sitios.filter(x => {
        const k = x.nombre.toLowerCase();
        if (vistos.has(k)) return false;
        vistos.add(k); return true;
      }).sort((a,b) => (b.merito - a.merito) || (a.km - b.km));

      if (unicos.length) return { listo:true, valor: unicos.slice(0, 20) };
      if (n === 0) return { vacia:true };      // respondió y no hay nada de verdad
      return {};
    }
  }, { alProbar });
}

/* Dónde estamos, se llame como se llame en cada app */
function posActual(){
  if (typeof MIPOS !== "undefined" && MIPOS) return MIPOS;
  if (typeof miPos !== "undefined" && miPos) return miPos;
  return null;
}

/* Repinta la vista que contiene el buscador, sea cual sea */
function repintaBusqueda(){
  if (typeof vistaGuia === "function") return vistaGuia();
  if (typeof vistaCerca === "function") return vistaCerca();
}

/* ---- Qué ver por aquí ---- */
let verCat = null, verKm = 10;

function bloqueQueVer(){
  if (!posActual()) return `<div class="card" id="c-quever">
    <h3>Qué ver por aquí</h3>
    <p class="note" style="margin-top:0">Monumentos, miradores, museos y sitios con interés alrededor de donde estéis.</p>
    <div class="btns"><button class="btn solid" id="btn-quever">Usar mi ubicación</button></div>
  </div>`;

  return `<div class="card" id="c-quever">
    <h3>Qué ver por aquí</h3>
    <div class="cats">${QUE_VER.map(c =>
      `<button class="cat${verCat === c.id ? " on" : ""}" data-ver="${c.id}">${c.n}</button>`).join("")}</div>
    <div class="radios">${[2,5,10,25].map(k =>
      `<button class="radio${verKm === k ? " on" : ""}" data-verkm="${k}">${k} km</button>`).join("")}</div>
    <div id="res-quever"></div>
  </div>`;
}

async function lanzarQueVer(presupuesto){
  const cont = document.getElementById("res-quever");
  const cat = QUE_VER.find(c => c.id === verCat);
  if (!cont || !cat) return;
  const op = abreBusqueda(presupuesto);
  pintaBuscando(cont, `Localizando…`);
  try {
    await ubicacionDeBusqueda(op);
    if (!op.viva()) { pintaFinBusqueda(cont, op, { estado:"cancelada" }, { km:verKm }); return; }

    progresoBusqueda(`Buscando ${cat.n.toLowerCase()} en ${verKm} km…`);
    const res = await queVerCerca(cat, comoPar(posActual()), verKm, op,
      n => progresoBusqueda(n === 0 ? `Buscando ${cat.n.toLowerCase()} en ${verKm} km…`
                                    : "Sigue buscando, probando otro servidor…"));

    if (res.estado === "reemplazada") return;          // ya hay otra búsqueda
    if (res.estado !== "bien"){
      if (res.estado === "vacia")
        cont.innerHTML = `<p class="note">Nada con nombre en ${verKm} km. Prueba a ampliar el radio o con otra categoría.</p>`;
      else pintaFinBusqueda(cont, op, res, { km:verKm });
      return;
    }
    const r = res.valor;

    cont.innerHTML = `<ul class="plain">${r.map((x, i) => `
      <li>
        <div class="serv-fila">
          <div><b>${esc(x.nombre)}</b>${x.detalle ? `<small>${esc(x.detalle)}</small>` : ""}</div>
          <span class="km" id="kv-${i}">${x.km < 1 ? Math.round(x.km*1000) + " m" : x.km.toFixed(1) + " km"}<i>recto</i></span>
        </div>
        <div class="btns" style="margin-top:6px">
          <a class="btn" href="${navegarXY(x.xy[0], x.xy[1])}" target="_blank" rel="noopener">Ir</a>
          <a class="btn" href="${mapaXY(x.xy[0], x.xy[1])}" target="_blank" rel="noopener">Ver</a>
          ${x.wiki ? `<a class="btn" target="_blank" rel="noopener"
            href="https://${x.wiki.includes(":") ? x.wiki.split(":")[0] : "es"}.wikipedia.org/wiki/${
              encodeURIComponent(x.wiki.includes(":") ? x.wiki.split(":").slice(1).join(":") : x.wiki)
            }">Qué es</a>` : ""}
        </div>
      </li>`).join("")}</ul>
      <p class="note" id="nota-quever">Calculando el tiempo por carretera…</p>`;

    // Los resultados ya están y ya sirven. Lo de abajo es mejora: si falla,
    // si se cancela o si tarda, la lista se queda como está.
    const t = await porCarreteraDeBusqueda(op, comoPar(posActual()), r.map(x => x.xy));
    const nv = document.getElementById("nota-quever");
    if (t){
      t.forEach((x, i) => {
        const el = document.getElementById("kv-" + i);
        if (el && x) el.innerHTML = `${formatoTiempo(x.seg)}<i>${x.km != null ? Math.round(x.km) + " km" : "en coche"}</i>`;
      });
      if (nv) nv.textContent = "Lo más interesante primero. Datos de OpenStreetMap, mantenidos por voluntarios.";
    } else if (nv){
      nv.textContent = "Distancias en línea recta. Datos de OpenStreetMap.";
    }
  } catch (e) {
    if (op.viva()) pintaFinBusqueda(cont, op, { estado:"fallaron", motivo:String((e && e.message) || e) }, { km:verKm });
  } finally {
    cierraBusqueda(op);
  }
}

function activaQueVer(){
  const b = document.getElementById("btn-quever");
  if (b) b.addEventListener("click", () => trabajando(b, "Localizando…", async () => {
    await pedirUbicacion();
    repintaBusqueda();
  }, { fallo:"No se pudo situarte" }));
  document.querySelectorAll("[data-ver]").forEach(x => x.addEventListener("click", () => {
    verCat = x.dataset.ver; repintaBusqueda(); lanzarQueVer();
  }));
  document.querySelectorAll("[data-verkm]").forEach(x => x.addEventListener("click", () => {
    verKm = +x.dataset.verkm; repintaBusqueda(); if (verCat) lanzarQueVer();
  }));
}
/* ---- Servicios cerca, con OpenStreetMap ---- */
/* La posición llega unas veces como "46.3,14.1" y otras como [46.3, 14.1]:
   cada app la guarda a su manera. Esta función admite ambas y devuelve
   siempre el mismo formato de texto, o null si no vale. */
/* ---- Cuál es el viaje que manda ----
   Eslovenia y Asturias traen sus datos escritos en su datos.js. En
   cuanto se editan desde el editor, la versión buena pasa a ser la
   guardada en el móvil, que además se sincroniza con el otro teléfono.
   Aquí se decide cuál de las dos se usa. Borrar la copia guardada
   devuelve el viaje tal y como venía en el archivo: se puede deshacer. */
function viajeEnUso(id, delArchivo){
  try {
    const propios = JSON.parse(localStorage.getItem("viajes_propios")) || [];
    const guardado = propios.find(v => v && v.id === id && !v.borrado);
    // Solo si tiene días: un viaje vacío por un guardado a medias no
    // puede dejar la app sin itinerario en mitad de la carretera.
    if (guardado && Array.isArray(guardado.dias) && guardado.dias.length){
      // El archivo debajo, la copia encima. La copia puede venir de una
      // nube que todavía no sabe guardar todos los bloques —una base sin
      // la columna `extra`— y entonces trae los días pero no la guía, ni
      // los vuelos, ni los seguros. Lo que la copia no traiga se queda
      // como está en el archivo, en vez de desaparecer.
      return { ...delArchivo, ...guardado };
    }
  } catch {}
  return delArchivo;
}

/* ¿Este viaje ya tiene una copia editada guardada en el móvil? */
function hayCopiaPropia(id){
  try {
    const propios = JSON.parse(localStorage.getItem("viajes_propios")) || [];
    return propios.some(v => v && v.id === id);
  } catch { return false; }
}

/* Quita la copia editada: el viaje vuelve a ser el del archivo.
   No toca el diario ni las fotos, que van por su cuenta. SYNC.borrar()
   deja apuntado el borrado si no hay cobertura, para que no resucite. */
function borraCopiaPropia(id){
  try {
    const propios = JSON.parse(localStorage.getItem("viajes_propios")) || [];
    localStorage.setItem("viajes_propios", JSON.stringify(propios.filter(v => v && v.id !== id)));
    if (typeof SYNC !== "undefined") SYNC.borrar(id).catch(() => {});
    return true;
  } catch { return false; }
}

/* ---- Llevar el viaje al editor ----
   El editor es otra app, en otra carpeta. Aquí se deja el viaje en el
   almacén del móvil y se abre el editor, que lo recoge.

   El problema: en iOS, una app añadida a la pantalla de inicio tiene su
   propio almacén, separado del de Safari. WebKit lo confirma como
   intencional (bug 181849). Si al abrir el editor se sale del contenedor
   de la app, el almacén ya no es el mismo y el viaje no llega.

   No se puede saber de antemano si pasará: depende de si iOS mantiene la
   navegación dentro de la app instalada, y eso cambia entre versiones y no
   está documentado. Así que en vez de suponerlo, se comprueba en el propio
   móvil: el editor deja un acuse de recibo cuando el viaje le llega. Hasta
   que ese acuse aparece, no se da por bueno el camino. */
const TRASPASO = "traspaso_viaje";
const TRASPASO_OK = "traspaso_ok";

function dejaTraspaso(id, viaje){
  const vale = "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  try {
    localStorage.setItem(TRASPASO, JSON.stringify({ vale, id, viaje }));
    return vale;
  } catch { return null; }   // sin sitio o en modo privado
}

/* ¿Quedó un traspaso sin recoger? Entonces el editor no llegó a verlo. */
function traspasoSinRecoger(id){
  try {
    const t = JSON.parse(localStorage.getItem(TRASPASO) || "null");
    return !!(t && t.id === id);
  } catch { return false; }
}

/* ¿Se ha comprobado ya en este móvil que el editor sí recibe el viaje? */
function traspasoFunciona(){
  try { return localStorage.getItem(TRASPASO_OK) === "1"; } catch { return false; }
}

function bloqueEditarViaje(){
  const editado = hayCopiaPropia(VIAJE_ID);
  // Solo se da por fallido si nunca ha funcionado en este móvil: si ya
  // llegó alguna vez, un traspaso sin recoger es que el usuario volvió
  // atrás antes de que el editor cargara, no que el camino esté roto.
  const falloElCamino = !editado && traspasoSinRecoger(VIAJE_ID) && !traspasoFunciona();

  const cuerpo = editado ? `
      <p>Estás viendo tu versión. Puedes seguir cambiándola, o volver al viaje
         tal y como venía: las marcas, las notas y las fotos no se tocan.</p>
      <div class="btns">
        <a class="btn solid" href="#" id="btn-editar">Seguir editando</a>
        <button class="btn" id="btn-original">Volver al viaje original</button>
      </div>`
    : falloElCamino ? `
      <p>El editor no ha recibido el viaje. Este iPhone guarda cada app de la
         pantalla de inicio por separado, así que lo que guarda esta app no lo
         ve el editor.</p>
      <p>Copia el viaje y pégalo en el editor, en «Importar». Lo que cambies
         allí se queda allí: para que vuelva aquí hace falta entrar con la
         cuenta y tener cobertura.</p>
      <div class="btns">
        <button class="btn solid" id="btn-copiar">Copiar el viaje</button>
        <a class="btn" href="#" id="btn-editar">Probar otra vez</a>
      </div>`
    : `
      <p>Días, paradas, horarios, notas y alojamiento. Lo que cambies se guarda
         en el móvil y lo ve el otro. La guía y las reservas se conservan aunque
         el editor todavía no las enseñe.</p>
      <div class="btns"><a class="btn solid" href="#" id="btn-editar">Abrir en el editor</a></div>`;

  return `<div class="hotel-zona">
    <span class="label">Cambiar el plan</span>
    <div class="card" style="margin-top:8px">
      <h3>Editar este viaje</h3>
      ${cuerpo}
      <p class="note" id="aviso-copia"></p>
    </div>
  </div>`;
}

function activaEditarViaje(){
  const b = document.getElementById("btn-editar");
  if (b) b.addEventListener("click", e => {
    e.preventDefault();
    const vale = dejaTraspaso(VIAJE_ID, VIAJE);
    if (!vale){ b.textContent = "Este móvil no deja guardar"; return; }
    location.href = "../crear/?id=" + encodeURIComponent(VIAJE_ID) + "&traspaso=" + vale;
  });

  const c = document.getElementById("btn-copiar");
  if (c) c.addEventListener("click", async () => {
    const aviso = document.getElementById("aviso-copia");
    const texto = JSON.stringify(VIAJE);
    try {
      await navigator.clipboard.writeText(texto);
      if (aviso) aviso.textContent = "Copiado. Abre el editor y pulsa «Importar».";
    } catch {
      if (aviso) aviso.innerHTML =
        `<textarea readonly rows="4" style="width:100%">${esc(texto)}</textarea>
         <br>Mantén pulsado dentro, «Seleccionar todo», y copia.`;
    }
  });

  const o = document.getElementById("btn-original");
  if (o) o.addEventListener("click", () => {
    if (!confirm("¿Volver al viaje original? Se pierden los cambios que hayas hecho al itinerario. Las marcas, las notas y las fotos se quedan.")) return;
    borraCopiaPropia(VIAJE_ID);
    location.reload();
  });
}

/* ---- Cómo va todo, en la pestaña Información ----
   El mismo modelo que la portada y el editor, en una línea. Va aquí y no
   en la cabecera a propósito: la cabecera es lo que se mira conduciendo
   para saber dónde estás, no para saber si hay wifi. */
function bloqueEstado(){
  return `<div class="hotel-zona">
    <span class="label">Cómo va</span>
    <div class="card" style="margin-top:8px">
      <button class="estado-linea" id="est-linea" aria-live="polite"
              aria-expanded="false" aria-controls="est-mas">comprobando…</button>
      <div id="est-mas" hidden></div>
    </div>
  </div>`;
}

async function activaEstado(){
  const linea = document.getElementById("est-linea");
  if (!linea || typeof comoEstaTodo !== "function") return;

  const e = await comoEstaTodo();
  pintaResumenEn(linea, resumenDeEstado(e));

  linea.addEventListener("click", () => {
    const mas = document.getElementById("est-mas");
    if (!mas) return;
    const abierto = linea.getAttribute("aria-expanded") === "true";
    linea.setAttribute("aria-expanded", String(!abierto));
    mas.hidden = abierto;
    if (!abierto) mas.innerHTML = detalleEstado(e);
  });
}

/* ---- La guía, indexada por su id ----
   Una parada apunta a su ficha con `g`, y esto es lo que convierte ese
   nombre en la ficha. Los dos viajes lo hacían por su cuenta, uno desde
   una lista suelta y otro desde dentro del viaje. */
function indexaGuia(viaje){
  const porId = {};
  ((viaje && viaje.guia) || []).forEach(z =>
    (z.lugares || []).forEach(l => { porId[l.id] = l; l.zona = z.zona; }));
  return porId;
}

function comoTexto(v){
  if (!v) return null;
  const p = Array.isArray(v) ? v.map(Number) : String(v).split(",").map(Number);
  return (p.length === 2 && p.every(n => Number.isFinite(n))) ? `${p[0]},${p[1]}` : null;
}
function comoPar(v){
  const t = comoTexto(v);
  return t ? t.split(",").map(Number) : null;
}

/* Coordenadas de una parada: propias, o las de su ficha en la guía */
function xyDeParada(p){
  if (p.xy) return p.xy;
  if (p.g && typeof LUGARES !== "undefined" && LUGARES[p.g] && LUGARES[p.g].xy) return LUGARES[p.g].xy;
  return null;
}

/* Puntos repartidos por el camino de hoy: para buscar «de paso» */
function puntosDeRuta(i, posAhora){
  const d = VIAJE && VIAJE.dias && VIAJE.dias[i];
  if (!d) return [];

  const pts = [];
  const mete = v => {
    const p = comoPar(v);
    if (p && !pts.some(q => q[0] === p[0] && q[1] === p[1])) pts.push(p);
  };

  const yo = comoPar(posAhora) ||
             comoPar((typeof MIPOS !== "undefined" && MIPOS) ||
                     (typeof miPos !== "undefined" && miPos) || null);

  // Todo el recorrido del día, en orden
  const ruta = [];
  (d.paradas || []).forEach(p => {
    const q = comoPar(typeof xyDeParada === "function" ? xyDeParada(p) : p.xy);
    if (q) ruta.push(q);
  });
  const cama = comoPar(d.xy);
  if (cama) ruta.push(cama);

  // Si sabemos dónde estamos, solo interesa lo que queda POR DELANTE:
  // en un día de traslado largo, buscar en toda la jornada devuelve sitios
  // a 180 km que no sirven de nada.
  if (yo && ruta.length){
    let masCerca = 0, mejor = Infinity;
    ruta.forEach((q, k) => {
      const dd = distancia(yo, q);
      if (dd < mejor){ mejor = dd; masCerca = k; }
    });
    // Desde donde estás hacia delante, pero solo el tramo próximo: en un día
    // de traslado largo no sirve de nada una gasolinera a 180 km.
    const TRAMO = 60;                    // km de recorrido por delante
    mete(yo);
    for (const q of ruta.slice(masCerca)){
      if (distancia(yo, q) > TRAMO) break;
      mete(q);
    }
    // si el siguiente punto ya queda lejísimos, al menos se mira alrededor
    if (pts.length === 1 && ruta[masCerca]) mete(ruta[masCerca]);
    return pts;
  }

  if (yo) mete(yo);
  ruta.slice(0, 4).forEach(mete);
  return pts;
}

let ULTIMO_FALLO = null;   // para poder enseñar qué pasó exactamente

/* Vuelve a preguntar dónde estás. La posición guardada envejece: en un día de
   traslado, buscar «de camino» con la posición de hace dos horas ofrece sitios
   que ya has pasado. */
async function ubicacionFresca(){
  return new Promise(ok => {
    if (!navigator.geolocation) return ok(null);
    navigator.geolocation.getCurrentPosition(
      p => {
        const par = [p.coords.latitude, p.coords.longitude];
        // cada app guarda la posición a su manera: se le pide que la actualice
        try { if (typeof guardaPosicion === "function") guardaPosicion(par); } catch {}
        ok(par);
      },
      () => ok(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }   // como mucho medio minuto
    );
  });
}

async function buscarEnRuta(cat, i, km, aqui, op, alProbar){
  // La posición llega de fuera: antes se pedía aquí Y en quien llama, así
  // que «de camino hoy» podía esperar dos veces al GPS, diez segundos cada
  // una. Ahora el orquestador es el único que la pide.
  const todos = puntosDeRuta(i, aqui);
  if (todos.length < 2) return null;          // sin ruta que seguir

  // Un solo rectángulo que engloba el día, en vez de un círculo por parada:
  // para Overpass es muchísimo más barato y responde a la primera.
  const lats = todos.map(p => p[0]), lons = todos.map(p => p[1]);
  const margen = Math.min(km, 12) / 111;      // en grados, aprox.
  const caja = [
    (Math.min(...lats) - margen).toFixed(4),
    (Math.min(...lons) - margen * 1.4).toFixed(4),
    (Math.max(...lats) + margen).toFixed(4),
    (Math.max(...lons) + margen * 1.4).toFixed(4)
  ].join(",");

  const SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  const intentos = [ {tope:80, espera:25}, {tope:40, espera:15}, {tope:20, espera:10} ]
    .map(x => ({ ...x, ms: (x.espera + 6) * 1000 }));

  return conPresupuesto(op, intentos, async (n, senal) => {
    const { tope, espera } = intentos[n];
    const partes = cat.q.split(";").map(t => `${t}(${caja});`).join("");
    const consulta = `[out:json][timeout:${espera}];(${partes});out center ${tope};`;
    {
      const r = await fetch(SERVIDORES[n % SERVIDORES.length] + "?data=" + encodeURIComponent(consulta),
                            { signal: senal });
      if (!r.ok){
        // el cuerpo del error suele explicar qué no le gustó
        let detalle = "";
        try { detalle = (await r.text()).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120); } catch {}
        ULTIMO_FALLO = { servidor: SERVIDORES[n % SERVIDORES.length], estado: r.status, detalle, consulta };
        return { motivo: r.status === 429 ? "ocupado"
                       : r.status === 504 ? "lento"
                       : `HTTP ${r.status}${detalle ? " · " + detalle : ""}` };
      }
      const d = await r.json();
      if (d.remark){
        ULTIMO_FALLO = { remark: d.remark, consulta };
        return { motivo: "aviso: " + String(d.remark).slice(0, 100) };
      }
      const origen = todos[0];
      const sitios = (d.elements || []).map(e => {
        const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
        if (la == null) return null;
        // cuánto te desvías del camino que te queda
        const desvio = Math.min(...todos.map(p => distancia(p, [la, lo])));
        const desdeAqui = distancia(todos[0], [la, lo]);
        return { nombre: e.tags?.name || cat.n,
                 detalle: e.tags?.["addr:street"] || e.tags?.operator || "",
                 xy:[la, lo], km: distancia(origen, [la, lo]), desvio, desdeAqui };
      }).filter(Boolean)
        .filter(x => x.desvio <= Math.min(km, 12))
        .filter(x => x.desdeAqui <= 80)      // nada a hora y media de distancia
        // primero lo que pillas pronto: se ordena por lo lejos que está de ti,
        // ya filtrado a lo que queda de paso
        .sort((a,b) => a.desdeAqui - b.desdeAqui);
      if (sitios.length) return { listo:true, valor: sitios.slice(0, 20) };
      if (n === 0) return { vacia:true };
      return {};
    }
  }, { alProbar });
}

async function buscarServicios(cat, pos, km, op, alProbar){
  // Tres servidores: si uno está saturado, se prueba el siguiente.
  // Y cada intento pide menos: mejor quince sitios que ninguno.
  const SERVIDORES = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];
  const partes = cat.q.split(";").map(t => `${t}(around:${km*1000},${pos[0]},${pos[1]});`).join("");
  const intentos = [ {tope:40, espera:25}, {tope:20, espera:15}, {tope:10, espera:10} ]
    .map(x => ({ ...x, ms: (x.espera + 6) * 1000 }));

  return conPresupuesto(op, intentos, async (n, senal) => {
    const { tope, espera } = intentos[n];
    const servidor = SERVIDORES[n % SERVIDORES.length];
    const consulta = `[out:json][timeout:${espera}];(${partes});out center ${tope};`;
    {
      const r = await fetch(servidor + "?data=" + encodeURIComponent(consulta), { signal: senal });
      if (!r.ok){
        return { motivo: r.status === 429 ? "ocupado" : r.status === 504 ? "lento" : String(r.status) };
      }
      const d = await r.json();
      const sitios = (d.elements || []).map(e => {
        const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
        if (la == null) return null;
        return { nombre: e.tags?.name || cat.n,
                 detalle: e.tags?.["addr:street"] || e.tags?.operator || "",
                 xy:[la, lo], km: distancia(pos, [la, lo]) };
      }).filter(Boolean).sort((a,b) => a.km - b.km);
      if (sitios.length) return { listo:true, valor: sitios.slice(0, 20) };
      if (n === 0) return { vacia:true };      // no hay nada de verdad
      return {};
    }
  }, { alProbar });
}

/* ---- Cámara y fotos del día ---- */
function cajaFotos(i, ctx = "hoy"){
  return `<div class="fotos-dia" id="fotos-${ctx}-${i}">
    <span class="label">Fotos del día</span>
    <div class="galeria" id="gal-${ctx}-${i}"></div>
    <div class="btns">
      <label class="btn solid camara">
        <input type="file" accept="image/*" capture="environment" data-camara="${ctx}:${i}" hidden>
        <span>Hacer una foto</span>
      </label>
      <label class="btn">
        <input type="file" accept="image/*" multiple data-carrete="${ctx}:${i}" hidden>
        <span>Del carrete</span>
      </label>
    </div>
  </div>`;
}

async function pintaGaleria(i, traer = true, ctx = "hoy"){
  const g = document.getElementById(`gal-${ctx}-${i}`);
  if (!g) return;
  let fs = await FOTOS.delDia(VIAJE_ID, i);
  if (traer){
    // pintamos lo que hay y, mientras, miramos si el otro móvil subió algo
    FOTOS.traerDelDia(VIAJE_ID, i).then(n => { if (n) pintaGaleria(i, false, ctx); }).catch(()=>{});
  }
  g.innerHTML = fs.length
    ? fs.map(f => {
        const esPortada = typeof DIARIO_SYNC !== "undefined" && DIARIO_SYNC.portada(VIAJE_ID, i) === f.id;
        return `<div class="miniatura${esPortada ? " portada" : ""}">
         <img src="${f.datos}" alt="" data-ver="${f.id}">
         <button class="quitar" data-borrar-foto="${f.id}" aria-label="Quitar">×</button>
         <button class="estrella" data-portada="${f.id}" aria-label="Portada del día"
           title="Portada del día">${esPortada ? "★" : "☆"}</button>
       </div>`; }).join("")
    : `<p class="note" style="margin:6px 0 0">Todavía no hay ninguna.</p>`;

  g.querySelectorAll("[data-borrar-foto]").forEach(b => b.addEventListener("click", async () => {
    if (!confirm("¿Quitar esta foto?")) return;
    await FOTOS.borrar(b.dataset.borrarFoto);
    pintaGaleria(i, false, ctx);
  }));
  g.querySelectorAll("[data-ver]").forEach(im => im.addEventListener("click", () => verFoto(im.src)));
  g.querySelectorAll("[data-portada]").forEach(b => b.addEventListener("click", () => {
    if (typeof DIARIO_SYNC === "undefined") return;
    DIARIO_SYNC.ponPortada(VIAJE_ID, i, b.dataset.portada);
    pintaGaleria(i, false, ctx);
    pintaPortada(i, ctx);
  }));
}

async function pintaPortada(i, ctx = "hoy"){
  const z = document.getElementById(`portada-${ctx}`);
  if (!z || typeof DIARIO_SYNC === "undefined") return;
  const id = DIARIO_SYNC.portada(VIAJE_ID, i);
  if (!id){ z.innerHTML = ""; return; }
  const f = await FOTOS.una(id);
  if (!f){ z.innerHTML = ""; return; }
  z.innerHTML = `<img class="foto-portada" src="${f.datos}" alt="">`;
  z.querySelector("img").addEventListener("click", () => verFoto(f.datos));
}

function verFoto(src){
  const v = document.createElement("div");
  v.className = "visor-foto";
  v.innerHTML = `<img src="${src}" alt=""><button class="cerrar">Cerrar</button>`;
  v.addEventListener("click", () => v.remove());
  document.body.appendChild(v);
}

function activaCamara(i, ctx = "hoy"){
  document.querySelectorAll(`[data-camara="${ctx}:${i}"], [data-carrete="${ctx}:${i}"]`).forEach(inp => {
    if (inp.dataset.listo) return;
    inp.dataset.listo = "1";
    // Una tanda cada vez. Comprimir y guardar tarda, y una segunda
    // selección mientras tanto guardaba las mismas fotos dos veces.
    let procesando = false;
    inp.addEventListener("change", async e => {
      const archivos = [...(e.target.files || [])];
      if (!archivos.length) return;      // canceló el selector: nada que bloquear
      if (procesando) return;            // ya hay una tanda en marcha
      procesando = true;

      const control = inp.parentElement;
      const eti = control ? control.querySelector("span") : null;
      const original = eti ? eti.textContent : "";
      if (eti) eti.textContent = archivos.length > 1 ? `Guardando ${archivos.length}…` : "Guardando…";
      if (control) control.setAttribute("aria-busy", "true");

      let fallos = 0;
      try {
        for (const a of archivos){
          try {
            const datos = await comprimirFoto(a);
            const id = await FOTOS.guardar(VIAJE_ID, i, datos);
            if (!id) fallos++;
          } catch { fallos++; }
        }
      } finally {
        // Pase lo que pase, el control vuelve a estar disponible
        procesando = false;
        if (eti) eti.textContent = original;
        if (control) control.removeAttribute("aria-busy");
        inp.value = "";
      }

      if (fallos) alert(fallos === archivos.length
        ? "No se pudieron guardar las fotos en este móvil."
        : `${fallos} de ${archivos.length} no se pudieron guardar.`);
      pintaGaleria(i, false, ctx);
    });
  });
}

/* ---- Mapa del día: lo previsto, por dónde se ha ido y dónde estás ---- */
function mapaDia(i, ctx = "hoy"){
  const d = VIAJE.dias[i];
  const previstas = (d.paradas || []).map((p, k) => ({
    n: (p.c || p.txt), xy: (typeof xyDeParada === "function" ? xyDeParada(p) : p.xy), k
  })).filter(x => x.xy);
  const dormir = d.xy ? { n: "Noche", xy: d.xy, cama: true } : null;
  const reales = (typeof DIARIO_SYNC !== "undefined")
    ? DIARIO_SYNC.recorridoReal(VIAJE_ID).filter(r => String(r.dia) === String(i)) : [];

  const yo = (typeof MI_POS !== "undefined") ? comoTexto(MI_POS) : null;
  const todos = [...previstas, ...(dormir ? [dormir] : []), ...reales.map(r => ({ xy:r.xy }))]
    .map(x => ({ ...x, xy: comoTexto(x.xy) })).filter(x => x.xy);
  if (yo) todos.push({ xy: yo });
  if (todos.length < 2) return "";

  const pts = todos.map(x => comoPar(x.xy));
  const lats = pts.map(p => p[0]), lons = pts.map(p => p[1]);
  const k = Math.cos((Math.min(...lats) + Math.max(...lats)) / 2 * Math.PI / 180);
  let y0 = Math.min(...lats), y1 = Math.max(...lats);
  let x0 = Math.min(...lons) * k, x1 = Math.max(...lons) * k;
  const mx = Math.max((x1 - x0) * 0.18, 0.006), my = Math.max((y1 - y0) * 0.18, 0.006);
  x0 -= mx; x1 += mx; y0 -= my; y1 += my;

  const W = 320, H = 190, P = 18;
  const esc2 = Math.min((W - P*2) / (x1 - x0), (H - P*2) / (y1 - y0));
  const dx = (W - (x1 - x0) * esc2) / 2, dy = (H - (y1 - y0) * esc2) / 2;
  const cx = lon => ((lon * k - x0) * esc2 + dx).toFixed(1);
  const cy = lat => (H - ((lat - y0) * esc2 + dy)).toFixed(1);
  const XY = xy => { const [a, b] = comoPar(xy); return `${cx(b)},${cy(a)}`; };

  const lineaPrev = [...previstas, ...(dormir ? [dormir] : [])].map(x => XY(x.xy)).join(" ");
  const lineaReal = reales.map(r => comoTexto(r.xy)).filter(Boolean).map(XY).join(" ");

  return `<div class="mapa-dia">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa del día">
      ${lineaPrev ? `<polyline class="prev" points="${lineaPrev}"/>` : ""}
      ${reales.length > 1 ? `<polyline class="real" points="${lineaReal}"/>` : ""}
      ${reales.map(r => comoTexto(r.xy)).filter(Boolean).map(t => `<circle class="pisada" cx="${XY(t).split(",")[0]}" cy="${XY(t).split(",")[1]}" r="3"/>`).join("")}
      ${previstas.map(x => `<g class="pp" data-parada="${x.k}">
          <circle cx="${XY(x.xy).split(",")[0]}" cy="${XY(x.xy).split(",")[1]}" r="6.5"/>
          <text x="${XY(x.xy).split(",")[0]}" y="${+XY(x.xy).split(",")[1] + 3.2}">${x.k + 1}</text>
        </g>`).join("")}
      ${dormir ? `<g class="cama-d">
          <circle cx="${XY(dormir.xy).split(",")[0]}" cy="${XY(dormir.xy).split(",")[1]}" r="7"/>
        </g>` : ""}
      ${yo ? `<g class="yo">
          <circle class="halo" cx="${XY(yo).split(",")[0]}" cy="${XY(yo).split(",")[1]}" r="11"/>
          <circle cx="${XY(yo).split(",")[0]}" cy="${XY(yo).split(",")[1]}" r="4.5"/>
        </g>` : ""}
    </svg>
    <div class="leyenda">
      <span><i class="c-prev"></i>Lo previsto</span>
      ${reales.length ? `<span><i class="c-real"></i>Por dónde fuimos</span>` : ""}
      ${yo ? `<span><i class="c-yo"></i>Estás aquí</span>` : ""}
      ${!yo ? `<button class="lnk" data-mi-pos="${ctx}:${i}">situarme</button>` : ""}
    </div>
  </div>`;
}

let MI_POS = null;
// si el aviso de cercanía ya pidió la ubicación, se reutiliza

/* Situarse rápido: primero lo que el móvil sepa ya (wifi, antenas), y si el
   GPS afina después, se corrige. Esperar al GPS antes de pintar nada hace que
   parezca colgado. */
function ubicacionRapida(){
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal("sin gps");
    let resuelto = false;
    const listo = p => {
      if (resuelto) return;
      resuelto = true;
      ok([p.coords.latitude, p.coords.longitude]);
    };
    // primero, cualquier posición reciente que ya tenga el móvil
    navigator.geolocation.getCurrentPosition(listo, () => {},
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 });
    // y en paralelo la buena, que corrige si llega antes de resolverse
    navigator.geolocation.getCurrentPosition(listo,
      e => { if (!resuelto){ resuelto = true; mal(e.message || "sin ubicación"); } },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

function activaMapaDia(i, ctx = "hoy"){
  document.querySelectorAll(`[data-mi-pos="${ctx}:${i}"]`).forEach(b => {
    if (b.dataset.listo) return; b.dataset.listo = "1";
    b.addEventListener("click", () => trabajando(b, "localizando…", async () => {
        const p = await ubicacionRapida();
        MI_POS = Array.isArray(p) ? p.join(",") : p;
        refrescaMapaDia(i, ctx);
        // el GPS suele afinar unos segundos después: se corrige en silencio
        if (typeof ubicacionFresca === "function")
          ubicacionFresca().then(mejor => {
            if (!mejor) return;
            const antes = comoPar(MI_POS);
            if (antes && distancia(antes, mejor) < 0.05) return;   // ya era buena
            MI_POS = mejor.join(",");
            refrescaMapaDia(i, ctx);
          }).catch(()=>{});
    }, { fallo:"no se pudo situarte" }));
  });
}

function refrescaMapaDia(i, ctx){
  const z = document.getElementById(`mapa-dia-${ctx}-${i}`);
  if (!z) return;
  z.innerHTML = mapaDia(i, ctx);
  activaMapaDia(i, ctx);
}

/* ---- Mapa de cabecera: el viaje entero o solo este día ---- */
let pestanaMapa = "dia";

function mapaCabecera(i, ctx = "hoy"){
  // el mapa general, sin sus botones propios: aquí manda la pestaña de arriba
  const general = (typeof mapaRuta === "function")
    ? mapaRuta().replace(/<div class="modos">[\s\S]*?<\/div>/, "") : "";
  const hoy = mapaDia(i, ctx);
  if (!general && !hoy) return "";
  const enDia = pestanaMapa === "dia" && hoy;

  return `<div class="mapa-cab">
    ${general && hoy ? `<div class="mapa-pes">
      <button class="mp${enDia ? " on" : ""}" data-pes="dia" data-ctx="${ctx}:${i}">Este día</button>
      <button class="mp${enDia ? "" : " on"}" data-pes="todo" data-ctx="${ctx}:${i}">El viaje entero</button>
    </div>` : ""}
    <div class="mapa-cuerpo">${enDia ? hoy : general}</div>
  </div>`;
}

function activaMapaCab(i, ctx = "hoy"){
  document.querySelectorAll(`[data-pes][data-ctx="${ctx}:${i}"]`).forEach(b =>
    b.addEventListener("click", () => {
      pestanaMapa = b.dataset.pes;
      refrescaMapaCab(i, ctx);
    }));
  activaMapaDia(i, ctx);
  if (typeof activaMapa === "function") activaMapa();
}

function refrescaMapaCab(i, ctx){
  const z = document.getElementById(`mapa-cab-${ctx}-${i}`);
  if (!z) return;
  z.innerHTML = mapaCabecera(i, ctx);
  activaMapaCab(i, ctx);
}

/* ---- El tiempo, con Open-Meteo (sin clave) ---- */
const TIEMPOS = {
  0:["Despejado","☀"], 1:["Poco nuboso","🌤"], 2:["Nuboso","⛅"], 3:["Cubierto","☁"],
  45:["Niebla","🌫"], 48:["Niebla helada","🌫"],
  51:["Llovizna","🌦"], 53:["Llovizna","🌦"], 55:["Llovizna fuerte","🌦"],
  61:["Lluvia floja","🌧"], 63:["Lluvia","🌧"], 65:["Lluvia fuerte","🌧"],
  66:["Lluvia helada","🌧"], 67:["Lluvia helada","🌧"],
  71:["Nieve","🌨"], 73:["Nieve","🌨"], 75:["Nieve fuerte","🌨"], 77:["Granizo","🌨"],
  80:["Chubascos","🌦"], 81:["Chubascos","🌦"], 82:["Chubascos fuertes","⛈"],
  85:["Chubascos de nieve","🌨"], 86:["Chubascos de nieve","🌨"],
  95:["Tormenta","⛈"], 96:["Tormenta con granizo","⛈"], 99:["Tormenta con granizo","⛈"]
};

async function elTiempo(la, lo){
  if (!navigator.onLine) return null;
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}` +
            `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
            `&timezone=auto&forecast_days=2`;
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(u, { signal: ctrl.signal });
    clearTimeout(corte);
    if (!r.ok) throw new Error(r.status);
    const d = (await r.json()).daily;
    if (!d) throw new Error("sin datos");
    return [0,1].map(i => ({
      code: d.weather_code[i], max: Math.round(d.temperature_2m_max[i]),
      min: Math.round(d.temperature_2m_min[i]), lluvia: d.precipitation_probability_max[i]
    }));
  } catch { clearTimeout(corte); return null; }
}

async function pintaTiempo(xy, donde){
  const z = document.getElementById("zona-tiempo");
  if (!z || !xy) return;
  const [la, lo] = xy.split(",").map(Number);
  const t = await elTiempo(la, lo);
  if (!t) return;
  const [hoy, man] = t;
  const [txtHoy, icoHoy] = TIEMPOS[hoy.code] || ["", "•"];
  const [txtMan, icoMan] = TIEMPOS[man.code] || ["", "•"];
  z.innerHTML = `<div class="tiempo">
    <div class="t-hoy">
      <span class="ico">${icoHoy}</span>
      <div>
        <b>${hoy.max}° / ${hoy.min}°</b>
        <small>${esc(txtHoy)}${hoy.lluvia != null ? ` · ${hoy.lluvia}% de lluvia` : ""}</small>
      </div>
    </div>
    <div class="t-man">
      <span>Mañana</span>
      <b>${icoMan} ${man.max}°/${man.min}°</b>
      ${man.lluvia != null ? `<small>${man.lluvia}%</small>` : ""}
    </div>
    <p class="fuente">${esc(donde)} · Open-Meteo</p>
  </div>`;
}


/* ═══ Modo conducción ═══════════════════════════════════════
   Una parada cada vez, letra grande y un solo botón. Se usa al
   volante: no pide ubicación, no reordena nada por distancia y
   no escribe en el diario. Solo lee lo que ya hay.

   Cada app aporta lo suyo con el mismo nombre: indiceHoy(),
   navegar(), navegarXY(), comoNavego() y esc(). Lo único que
   cambia de verdad es dónde vive el diario: Eslovenia y Asturias
   tienen DIARIO, el visor usa P. De ahí la adaptación de abajo.
   ═══════════════════════════════════════════════════════════ */

function botonModoConduccion(){
  return `<div class="conducir">
    <button class="btn solid" id="abrir-conduccion">Modo conducción</button>
  </div>`;
}

/* Qué paradas del día están hechas.
   Devuelve null —no una lista de falsos— cuando el diario no se
   puede consultar: no es lo mismo «ninguna hecha» que «no se sabe»,
   y en el segundo caso hay que empezar por la primera parada. */
function marcasDeParadas(iDia, cuantas){
  const diario =
    (typeof DIARIO !== "undefined" && DIARIO && typeof DIARIO.esta === "function") ? DIARIO :
    (typeof P !== "undefined" && P && typeof P.esta === "function") ? P : null;
  if (!diario) return null;
  try {
    const m = [];
    for (let k = 0; k < cuantas; k++) m.push(!!diario.esta(`${iDia}:${k}`));
    return m;
  } catch(e){ return null; }
}

/* Adónde lleva «Ir». Primero el destino escrito en los datos —el
   mismo orden que ya usan los chips de ruta, con el aparcamiento
   por delante del sitio— y solo si no hay ninguno, las coordenadas.
   Si no hay ni una cosa ni la otra devuelve null: una parada sin
   ubicación no puede inventarse una. */
function destinoDeParada(p){
  const texto = String((p.park && p.park.w) || p.w || p.mapa || "").trim();
  if (texto) return { url: navegar(texto), donde: texto };
  const par = comoPar(xyDeParada(p));
  if (par) return { url: navegarXY(par[0], par[1]), donde: `${par[0]}, ${par[1]}` };
  return null;
}

function activaModoConduccion(i){
  const boton = document.getElementById("abrir-conduccion");
  if (boton) boton.addEventListener("click", () => abreModoConduccion(i, boton));
}

function abreModoConduccion(i, boton){
  const dia = VIAJE && VIAJE.dias && VIAJE.dias[i];
  if (!dia) return;
  const paradas = dia.paradas || [];
  const cabecera = String(dia.t || dia.dest || `Día ${i + 1}`);

  // Dónde empezar: la primera que no esté hecha. Si el diario no se
  // puede leer, la primera de todas.
  const marcas = marcasDeParadas(i, paradas.length);
  let n = 0;
  if (marcas) while (n < paradas.length && marcas[n]) n++;

  const v = document.createElement("div");
  v.className = "conduce";
  v.setAttribute("role", "dialog");
  v.setAttribute("aria-modal", "true");
  v.setAttribute("aria-label", "Modo conducción");
  v.tabIndex = -1;

  let conHistorial = false;
  const alTeclado = e => { if (e.key === "Escape"){ e.preventDefault(); cierra(); } };
  const alVolver  = () => { conHistorial = false; cierra(); };

  function cierra(){
    document.removeEventListener("keydown", alTeclado);
    window.removeEventListener("popstate", alVolver);
    v.remove();
    // Deshacer la entrada del historial que se puso al abrir, para que
    // el botón Atrás no deje a nadie dando vueltas en una pantalla vacía.
    if (conHistorial){ conHistorial = false; try { history.back(); } catch(e){} }
    if (boton && document.body.contains(boton)) boton.focus();
  }

  function pinta(foco){
    const p = paradas[n];
    if (!p){
      v.innerHTML = `<div class="cd-texto">
          <p class="cd-cab">${esc(cabecera)}</p>
          <h1>No quedan más paradas para hoy</h1>
        </div>
        <div class="cd-acciones">
          <button class="cd-btn" id="cd-salir">Salir del modo conducción</button>
        </div>`;
    } else {
      const destino = destinoDeParada(p);
      v.innerHTML = `<div class="cd-texto">
          <p class="cd-cab">${esc(cabecera)} · parada ${n + 1} de ${paradas.length}</p>
          ${p.h ? `<p class="cd-hora">${esc(p.h)}</p>` : ""}
          <h1>${esc(p.txt || p.c || `Parada ${n + 1}`)}</h1>
          ${p.n ? `<p class="cd-nota">${esc(p.n)}</p>` : ""}
        </div>
        <div class="cd-acciones">
          ${destino
            ? `<a class="cd-btn cd-ir" href="${destino.url}" target="_blank" rel="noopener"
                  aria-label="Ir a ${esc(destino.donde)} con ${esc(comoNavego())}">Ir</a>`
            : `<p class="cd-sin">Esta parada no tiene ubicación</p>`}
          <button class="cd-btn" id="cd-sig">Siguiente</button>
          <button class="cd-btn" id="cd-salir">Salir del modo conducción</button>
        </div>`;
    }

    const sig = v.querySelector("#cd-sig");
    // «Siguiente» solo mueve el sitio donde estamos mirando: no marca
    // la parada, no toca el diario y no guarda nada.
    if (sig) sig.addEventListener("click", () => { n++; pinta("sig"); });
    v.querySelector("#cd-salir").addEventListener("click", cierra);

    const aFoco = foco === "sig" ? (sig || v) : v;
    try { aFoco.focus(); } catch(e){}
  }

  // Al DOM antes de pintar: si no, el foco inicial cae en un elemento
  // que todavía no está en la página y no se mueve nada.
  document.body.appendChild(v);
  pinta();
  document.addEventListener("keydown", alTeclado);
  try { history.pushState({ conduce: true }, ""); conHistorial = true; } catch(e){}
  window.addEventListener("popstate", alVolver);
}
