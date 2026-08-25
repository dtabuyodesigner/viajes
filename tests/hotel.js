const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const SYNCJS = fs.readFileSync(path.join(__dirname, '..', 'sync.js'), 'utf8');
const MOTOR = fs.readFileSync(path.join(__dirname, '..', 'assets/app.js'), 'utf8');
const FDB = require('fake-indexeddb');

const MD = `# Croacia
Salida: León

## Día 1 — Zagreb
Duermes en: Zagreb
Alojamiento: Hotel Jägerhorn · https://www.hotel-jagerhorn.hr
Coche: 40 km · 45 min

- **Tarde** · Centro — Pasear. [Presernov trg]

## Día 2 — Plitvice
Duermes en: Plitvice
Alojamiento: Casa Kordić

- **Mañana** · Lagos — Reserva online. [Plitvicka Jezera]`;

const alm = {}; let avisos = [];
const htmlC = fs.readFileSync(path.join(__dirname, '..', 'crear/index.html'),'utf8')
  .replace(/<script src="[^"]*sync\.js[^"]*"><\/script>/, `<script>\n${SYNCJS}\n</script>`);
const ed = new JSDOM(htmlC, { runScripts:"dangerously", url:"https://x/crear/", pretendToBeVisual:true,
  beforeParse(w){
    Object.defineProperty(w,"localStorage",{value:{getItem:k=>(k in alm?alm[k]:null),
      setItem:(k,v)=>{alm[k]=String(v)}, removeItem:k=>{delete alm[k]}}});
    Object.defineProperty(w.navigator,"onLine",{value:false,configurable:true});
    w.matchMedia = () => ({matches:false, addEventListener(){}, addListener(){}});
    w.indexedDB = new FDB.IDBFactory(); w.IDBKeyRange = FDB.IDBKeyRange;
    w.prompt = () => MD; w.alert = m => avisos.push(m.split("\n")[0]);
    w.confirm = m => { avisos.push(m.split("\n")[0]); return true; };
  }});

(async () => {
  await new Promise(r => setTimeout(r, 300));
  ed.window.document.getElementById("importar").click();
  await new Promise(r => setTimeout(r, 200));
  const v = JSON.parse(alm.viajes_propios)[0];
  console.log("═══ LO QUE SE LEE DEL MARKDOWN ═══");
  v.dias.forEach((d,i) => console.log(`  Día ${i+1}: ${d.hotel || "(sin hotel)"}${d.hotelWeb ? "  web: " + d.hotelWeb : ""}`));

  console.log("\n═══ CÓMO SE VE EN EL VIAJE ═══");
  const alm2 = { viajes_propios: JSON.stringify([v]) };
  const htmlV = fs.readFileSync(path.join(__dirname, '..', 'viaje/index.html'),'utf8')
    .replace(/<script src="[^"]*sync\.js[^"]*"><\/script>/, `<script>\n${SYNCJS}\n</script>`)
    .replace(/<script src="[^"]*assets\/app\.js[^"]*"><\/script>/, `<script>\n${MOTOR}\n</script>`);
  const vis = new JSDOM(htmlV, { runScripts:"dangerously", url:`https://x/viaje/?id=${v.id}`, pretendToBeVisual:true,
    beforeParse(w){
      Object.defineProperty(w,"localStorage",{value:{getItem:k=>(k in alm2?alm2[k]:null),
        setItem:()=>{}, removeItem:()=>{}}});
      Object.defineProperty(w.navigator,"onLine",{value:false,configurable:true});
      w.matchMedia = () => ({matches:false, addEventListener(){}, addListener(){}});
      w.indexedDB = new FDB.IDBFactory(); w.IDBKeyRange = FDB.IDBKeyRange;
      w.navigator.geolocation = { getCurrentPosition: () => {} };
    }});
  const q = vis.window.document;
  await new Promise(r => setTimeout(r, 700));
  const h = q.querySelector("#v-hoy .hotel-zona");
  console.log("  bloque:", h ? "sí" : "NO");
  if (h){
    console.log("  hotel:", h.querySelector("h3").textContent);
    [...h.querySelectorAll("a")].forEach(a => {
      const u = a.href.length > 60 ? a.href.slice(0, 58) + "…" : a.href;
      console.log(`    ${a.textContent.padEnd(14)} ${u}`);
    });
  }
})();
