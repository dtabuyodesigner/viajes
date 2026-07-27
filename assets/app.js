/* ═══════════════════════════════════════════════════════════
   Motor común de las apps de viaje.

   Aquí vive lo que es idéntico en Eslovenia, Asturias y el
   visor de viajes creados. Cada app aporta sus datos y sus
   piezas propias; esto es lo compartido.

   Depende de que la app defina antes: VIAJE, VIAJE_ID, PREF,
   esc(), navegarXY(). Como solo se usan al llamar a las
   funciones, no importa el orden de carga.

   Al tocar este archivo hay que subir el ?v=NN en las páginas
   que lo cargan, o el móvil seguirá con la versión antigua.
   ═══════════════════════════════════════════════════════════ */

/* ---- Tiempo real por carretera (OSRM, datos de OpenStreetMap) ---- */
function formatoTiempo(seg){
  const m = Math.round(seg / 60);
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r}` : `${h} h`;
}

async function porCarretera(origen, destinos){
  if (!navigator.onLine || !destinos.length) return null;
  const puntos = [origen, ...destinos].map(p => `${p[1]},${p[0]}`).join(";");
  const url = `https://router.project-osrm.org/table/v1/driving/${puntos}` +
              `?sources=0&annotations=duration,distance`;
  const ctrl = new AbortController();
  const corte = setTimeout(() => ctrl.abort(), 12000);
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
    return `<li class="visita">
      <div>
        <b>${esc(v.txt) || "Buscando el nombre…"}</b>
        <small>${v.manual ? "añadido a mano" : hora}${v.auto ? " · según OpenStreetMap" : ""}${
          v.precision ? ` · ±${v.precision} m` : ""}</small>
      </div>
      <div class="btns" style="margin-top:6px">
        <button class="btn fino" data-nombrar="${v.id}">${v.txt ? "Cambiar nombre" : "Ponerle nombre"}</button>
        <a class="btn fino" href="${navegarXY(...v.xy.split(",").map(Number))}" target="_blank" rel="noopener">Volver</a>
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
  b.addEventListener("click", async () => {
    const antes = b.textContent;
    b.textContent = "Localizando…";
    try {
      await DIARIO_SYNC.apuntarAqui(VIAJE_ID, i, "");
      b.textContent = "Guardado";
      pintaAqui(i, ctx);
      refrescaMapaCab(i, ctx);
      // el nombre llega un momento después, de OpenStreetMap
      setTimeout(() => pintaAqui(i, ctx), 1500);
      setTimeout(() => pintaAqui(i, ctx), 4000);
    } catch (e){ b.textContent = typeof e === "string" ? e : "No se pudo"; }
    setTimeout(() => { b.textContent = antes; }, 2200);
  });
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
        <a class="btn solid" href="${navegarXY(...p.xy.split(",").map(Number))}" target="_blank" rel="noopener">Volver aquí</a>
        <a class="btn" href="${mapaXY(...p.xy.split(",").map(Number))}" target="_blank" rel="noopener">Ver</a>
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

  z.querySelectorAll(`[data-dormir]`).forEach(b => b.addEventListener("click", async () => {
    b.textContent = "Localizando…";
    try {
      await DIARIO_SYNC.apuntarPernocta(VIAJE_ID, i);
      pintaPernocta(i, ctx);
      setTimeout(() => pintaPernocta(i, ctx), 1600);
      setTimeout(() => pintaPernocta(i, ctx), 4000);
    } catch (e){ b.textContent = typeof e === "string" ? e : "No se pudo"; }
  }));

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
    inp.addEventListener("change", async e => {
      const archivos = [...(e.target.files || [])];
      if (!archivos.length) return;
      const eti = inp.parentElement.querySelector("span");
      const original = eti ? eti.textContent : "";
      if (eti) eti.textContent = archivos.length > 1 ? `Guardando ${archivos.length}…` : "Guardando…";
      let fallos = 0;
      for (const a of archivos){
        try {
          const datos = await comprimirFoto(a);
          const id = await FOTOS.guardar(VIAJE_ID, i, datos);
          if (!id) fallos++;
        } catch { fallos++; }
      }
      if (eti) eti.textContent = original;
      inp.value = "";
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

  const todos = [...previstas, ...(dormir ? [dormir] : []), ...reales.map(r => ({ xy:r.xy }))];
  if (typeof MI_POS !== "undefined" && MI_POS) todos.push({ xy: MI_POS });
  if (todos.length < 2) return "";

  const pts = todos.map(x => x.xy.split(",").map(Number));
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
  const XY = xy => { const [a, b] = xy.split(",").map(Number); return `${cx(b)},${cy(a)}`; };

  const lineaPrev = [...previstas, ...(dormir ? [dormir] : [])].map(x => XY(x.xy)).join(" ");
  const lineaReal = reales.map(r => XY(r.xy)).join(" ");

  return `<div class="mapa-dia">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa del día">
      ${lineaPrev ? `<polyline class="prev" points="${lineaPrev}"/>` : ""}
      ${reales.length > 1 ? `<polyline class="real" points="${lineaReal}"/>` : ""}
      ${reales.map(r => `<circle class="pisada" cx="${XY(r.xy).split(",")[0]}" cy="${XY(r.xy).split(",")[1]}" r="3"/>`).join("")}
      ${previstas.map(x => `<g class="pp" data-parada="${x.k}">
          <circle cx="${XY(x.xy).split(",")[0]}" cy="${XY(x.xy).split(",")[1]}" r="6.5"/>
          <text x="${XY(x.xy).split(",")[0]}" y="${+XY(x.xy).split(",")[1] + 3.2}">${x.k + 1}</text>
        </g>`).join("")}
      ${dormir ? `<g class="cama-d">
          <circle cx="${XY(dormir.xy).split(",")[0]}" cy="${XY(dormir.xy).split(",")[1]}" r="7"/>
        </g>` : ""}
      ${(typeof MI_POS !== "undefined" && MI_POS) ? `<g class="yo">
          <circle class="halo" cx="${XY(MI_POS).split(",")[0]}" cy="${XY(MI_POS).split(",")[1]}" r="11"/>
          <circle cx="${XY(MI_POS).split(",")[0]}" cy="${XY(MI_POS).split(",")[1]}" r="4.5"/>
        </g>` : ""}
    </svg>
    <div class="leyenda">
      <span><i class="c-prev"></i>Lo previsto</span>
      ${reales.length ? `<span><i class="c-real"></i>Por dónde fuimos</span>` : ""}
      ${(typeof MI_POS !== "undefined" && MI_POS) ? `<span><i class="c-yo"></i>Estás aquí</span>` : ""}
      ${!(typeof MI_POS !== "undefined" && MI_POS) ? `<button class="lnk" data-mi-pos="${ctx}:${i}">situarme</button>` : ""}
    </div>
  </div>`;
}

let MI_POS = null;
// si el aviso de cercanía ya pidió la ubicación, se reutiliza

function activaMapaDia(i, ctx = "hoy"){
  document.querySelectorAll(`[data-mi-pos="${ctx}:${i}"]`).forEach(b => {
    if (b.dataset.listo) return; b.dataset.listo = "1";
    b.addEventListener("click", async () => {
      b.textContent = "localizando…";
      try {
        const p = await pedirUbicacion();
        MI_POS = Array.isArray(p) ? p.join(",") : p;
        refrescaMapaDia(i, ctx);
      } catch { b.textContent = "no se pudo"; }
    });
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

