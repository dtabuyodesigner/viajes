const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const SYNCJS = fs.readFileSync(path.join(__dirname, '..', 'sync.js'),'utf8');
const MOTOR = fs.readFileSync(path.join(__dirname, '..', 'assets/app.js'),'utf8');
const FDB = require('fake-indexeddb');

const alm = {};
const idb = new FDB.IDBFactory();
const html = fs.readFileSync(path.join(__dirname, '..', 'eslovenia/index.html'),'utf8')
  .replace(/<script src="[^"]*sync\.js[^"]*"><\/script>/, `<script>\n${SYNCJS}\n</script>`)
  .replace(/<script src="[^"]*assets\/app\.js[^"]*"><\/script>/, `<script>\n${MOTOR}\n</script>`);
const dom = new JSDOM(html, { runScripts:"dangerously", url:"https://x/eslovenia/", pretendToBeVisual:true,
  beforeParse(w){
    Object.defineProperty(w,"localStorage",{value:{getItem:k=>(k in alm?alm[k]:null),
      setItem:(k,v)=>{alm[k]=String(v)}, removeItem:k=>{delete alm[k]}}});
    Object.defineProperty(w.navigator,"onLine",{value:false,configurable:true});
    w.matchMedia = () => ({matches:false, addEventListener(){}, addListener(){}});
    w.indexedDB = idb; w.IDBKeyRange = FDB.IDBKeyRange;
    w.navigator.geolocation = { getCurrentPosition: () => {} };
    w.confirm = () => true; w.alert = m => console.log("  [alerta]", m);
    let calidad = null;
    w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage(){} });
    w.HTMLCanvasElement.prototype.toDataURL = function(t, q){ calidad = q; dom.calidad = q;
      dom.lado = Math.max(this.width, this.height);
      return "data:image/jpeg;base64,TARJETA"; };
    w.Image = class { set src(v){ this.width=3000; this.height=4000; setTimeout(()=>this.onload&&this.onload(),3); } };
    w.FileReader = class { readAsDataURL(){ setTimeout(()=>{ this.result="x"; this.onload&&this.onload(); },3); } };
    w.Date = class extends Date { constructor(...a){ super(...(a.length?a:["2026-07-28T21:00:00"])); }
      static now(){ return new Date("2026-07-28T21:00:00").getTime(); } };
  }});
const w = dom.window, d = w.document;

(async () => {
  await new Promise(r => setTimeout(r, 900));
  d.querySelector('nav button[data-v="reservas"]').click();
  await new Promise(r => setTimeout(r, 500));

  console.log("═══ EN CADA VUELO ═══");
  const zonas = d.querySelectorAll("#v-reservas .doc-zona");
  console.log("  zonas de tarjetas:", zonas.length, "(una por vuelo)");
  console.log("  título:", zonas[0]?.querySelector(".label")?.textContent);
  console.log("  botones:", [...zonas[1].querySelectorAll("label span")].map(x=>x.textContent).join(" / "));

  console.log("\n═══ SUBIR LAS DOS TARJETAS ═══");
  const inp = zonas[1].querySelector("[data-doc]");
  Object.defineProperty(inp, "files", { value:[{ name:"dani.jpg" }, { name:"pilar.jpg" }], configurable:true });
  inp.dispatchEvent(new w.Event("change", { bubbles:true }));
  await new Promise(r => setTimeout(r, 700));

  const z2 = d.querySelectorAll("#v-reservas .doc-zona")[1];
  console.log("  tarjetas guardadas:", z2.querySelectorAll(".doc-img").length);
  console.log("  texto:", z2.querySelector(".note")?.textContent);
  console.log("  calidad:", dom.calidad, "· lado mayor:", dom.lado, "px");
  console.log("  botones ahora:", [...z2.querySelectorAll("button")].map(b=>b.textContent).join(" / "));

  console.log("\n═══ VER A PANTALLA COMPLETA ═══");
  z2.querySelector("[data-doc-grande]").click();
  await new Promise(r => setTimeout(r, 300));
  const v = d.querySelector(".doc-visor");
  console.log("  se abre:", v ? "sí" : "NO");
  console.log("  contador:", v?.querySelector(".doc-pasar span")?.textContent);
  v?.querySelector('[data-ir="1"]')?.click();
  await new Promise(r => setTimeout(r, 100));
  console.log("  al pasar:", d.querySelector(".doc-pasar span")?.textContent);
  console.log("  fondo blanco para el lector:", v && /background:#fff/.test(
    [...d.styleSheets[0].cssRules].map(r=>r.cssText).join("")) ? "sí" : "(comprobar CSS)");
  d.querySelector(".doc-visor .cerrar").click();
  await new Promise(r => setTimeout(r, 100));
  console.log("  se cierra:", d.querySelector(".doc-visor") ? "NO" : "sí");

  console.log("\n═══ NO SE MEZCLA CON LAS FOTOS DEL DÍA ═══");
  const bd = await new Promise(ok => { const p = idb.open("viajes_fotos"); p.onsuccess = () => ok(p.result); });
  const todo = await new Promise(ok => {
    const t = bd.transaction("fotos","readonly").objectStore("fotos").getAll();
    t.onsuccess = () => ok(t.result);
  });
  console.log("  en la base de datos:", todo.length, "registro(s)");
  todo.forEach(x => console.log(`     id: ${x.id}  ·  dia: ${x.dia}  ·  doc: ${x.doc || "(foto normal)"}`));
  console.log("\n  las fotos del día usan dia>=0; los documentos, dia=-1 y campo doc");
})();
