const { JSDOM } = require('/home/claude/viaje/node_modules/jsdom');
const fs = require('fs');
const SYNCJS = fs.readFileSync('/home/claude/viaje/sync.js','utf8');
const MOTOR = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');
const FDB = require('/home/claude/viaje/node_modules/fake-indexeddb');

// Lo que devolvería Overpass en Venecia: mezcla de sitios con y sin interés
const VENECIA = { elements:[
  { lat:45.4341, lon:12.3388, tags:{ name:"Basilica di San Marco", historic:"church",
    wikipedia:"it:Basilica di San Marco", tourism:"attraction" }},
  { lat:45.4340, lon:12.3390, tags:{ name:"Palazzo Ducale", historic:"palace",
    wikipedia:"it:Palazzo Ducale (Venezia)" }},
  { lat:45.4380, lon:12.3358, tags:{ name:"Ponte di Rialto", historic:"bridge",
    wikipedia:"it:Ponte di Rialto" }},
  { lat:45.4310, lon:12.3320, tags:{ name:"Gallerie dell'Accademia", tourism:"museum",
    website:"https://x" }},
  { lat:45.4350, lon:12.3400, tags:{ historic:"memorial" }},          // sin nombre: fuera
  { lat:45.4360, lon:12.3370, tags:{ name:"Ponte di Rialto" }},       // repetido: fuera
  { lat:45.4400, lon:12.3300, tags:{ name:"Campo San Polo", place:"square" }}
]};

const alm = {};
const html = fs.readFileSync('/home/claude/viaje/eslovenia/index.html','utf8')
  .replace(/<script src="[^"]*sync\.js[^"]*"><\/script>/, `<script>\n${SYNCJS}\n</script>`)
  .replace(/<script src="[^"]*assets\/app\.js[^"]*"><\/script>/, `<script>\n${MOTOR}\n</script>`);
const dom = new JSDOM(html, { runScripts:"dangerously", url:"https://x/eslovenia/", pretendToBeVisual:true,
  beforeParse(w){
    Object.defineProperty(w,"localStorage",{value:{getItem:k=>(k in alm?alm[k]:null),
      setItem:(k,v)=>{alm[k]=String(v)}, removeItem:k=>{delete alm[k]}}});
    Object.defineProperty(w.navigator,"onLine",{value:true,configurable:true});
    w.matchMedia = () => ({matches:false, addEventListener(){}, addListener(){}});
    w.indexedDB = new FDB.IDBFactory(); w.IDBKeyRange = FDB.IDBKeyRange;
    w.navigator.geolocation = { getCurrentPosition: ok =>
      setTimeout(()=>ok({coords:{latitude:45.4345, longitude:12.3385}}),10) };
    w.fetch = async u => {
      const s = String(u);
      if (s.includes("interpreter")) return { ok:true, json: async () => VENECIA };
      if (s.includes("osrm")) return { ok:false, status:504 };
      return { ok:true, json: async () => ({}) };
    };
    w.Date = class extends Date { constructor(...a){ super(...(a.length?a:["2026-07-28T17:00:00"])); }
      static now(){ return new Date("2026-07-28T17:00:00").getTime(); } };
  }});
const d = dom.window.document;

(async () => {
  await new Promise(r => setTimeout(r, 900));
  d.querySelector('nav button[data-v="guia"]').click();
  await new Promise(r => setTimeout(r, 200));

  console.log("═══ EL BLOQUE, ANTES DE DAR UBICACIÓN ═══");
  const c = d.getElementById("c-quever");
  console.log("  aparece:", c ? "sí" : "NO");
  console.log("  título:", c?.querySelector("h3")?.textContent);
  console.log("  botón:", c?.querySelector("button")?.textContent);

  d.getElementById("btn-quever")?.click();
  await new Promise(r => setTimeout(r, 400));
  console.log("\n═══ CON UBICACIÓN (Plaza de San Marcos) ═══");
  console.log("  categorías:", [...d.querySelectorAll("#c-quever .cat")].map(x=>x.textContent).join(" / "));
  console.log("  radios:", [...d.querySelectorAll("#c-quever .radio")].map(x=>x.textContent).join(" "));

  d.querySelector('#c-quever [data-ver="monum"]').click();
  await new Promise(r => setTimeout(r, 900));
  console.log("\n═══ MONUMENTOS ═══");
  d.querySelectorAll("#res-quever li").forEach(li => {
    const wiki = li.querySelector('a[href*="wikipedia"]');
    console.log(`  ${li.querySelector(".km").textContent.replace(/\s+/g," ").padEnd(14)} ${li.querySelector("b").textContent.padEnd(26)} ${wiki ? "· Qué es" : ""}`);
  });
  console.log("\n  sin nombre y repetidos descartados:",
    7 - d.querySelectorAll("#res-quever li").length, "de 7");
  console.log("  nota:", d.getElementById("nota-quever")?.textContent);
})();
