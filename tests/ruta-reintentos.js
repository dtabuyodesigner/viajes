const fs = require('fs');
const MOTOR = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');

const VIAJE = { dias: [{ xy:"46.281,14.322", paradas:[
  { xy:"46.368,14.095" }, { xy:"46.363,14.096" }, { xy:"46.393,14.058" },
  { xy:"46.350,14.150" }, { xy:"46.330,14.200" }, { xy:"46.300,14.280" }
]}]};
const LUGARES = {};
const distancia = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]) * 111;
let MIPOS = "46.290,14.310";

async function probar(titulo, responder){
  const llamadas = [];
  const fetch = async (u) => {
    const s = decodeURIComponent(String(u));
    llamadas.push({ servidor: s.match(/https:\/\/([^/]+)/)[1],
                    puntos: (s.match(/around:/g)||[]).length,
                    radio: (s.match(/around:(\d+)/)||[,"?"])[1] });
    return responder(llamadas.length);
  };
  const ctx = { VIAJE, LUGARES, MIPOS, distancia, fetch,
                AbortController, setTimeout, clearTimeout, Math, Error, encodeURIComponent };
  const fn = new Function(...Object.keys(ctx),
    MOTOR.match(/function xyDeParada[\s\S]*?\n\}/)[0] + "\n" +
    MOTOR.match(/function puntosDeRuta[\s\S]*?\n\}/)[0] + "\n" +
    MOTOR.match(/async function buscarEnRuta[\s\S]*?\n\}\n/)[0] +
    "\nreturn buscarEnRuta;");
  const buscarEnRuta = fn(...Object.values(ctx));
  console.log(`\n═══ ${titulo}`);
  try {
    const r = await buscarEnRuta({ q:'node["amenity"="fuel"]', n:"Gasolinera" }, 0, 15);
    llamadas.forEach((l,k) => console.log(`   intento ${k+1}: ${l.servidor} · ${l.puntos} puntos · ${l.radio} m`));
    console.log(`   resultado: ${r ? r.length + " sitios" : "sin ruta"}`);
    if (r && r.length) console.log(`   el más cercano al camino: ${r[0].nombre}, ${r[0].desvio.toFixed(1)} km de desvío`);
  } catch (e){
    llamadas.forEach((l,k) => console.log(`   intento ${k+1}: ${l.servidor} · ${l.puntos} puntos · ${l.radio} m`));
    console.log(`   falló tras ${llamadas.length} intentos: ${e.message}`);
  }
}

const sitios = n => ({ ok:true, json: async () => ({ elements: Array.from({length:n}, (_,k) => ({
  lat: 46.30 + k*0.01, lon: 14.20 + k*0.01, tags:{ name:"Gasolinera " + (k+1) } })) })});

(async () => {
  await probar("Todo bien a la primera", () => sitios(12));
  await probar("El primero rechaza, el segundo responde",
    n => n === 1 ? { ok:false, status:429 } : sitios(8));
  await probar("Fallan dos, responde el tercero",
    n => n < 3 ? { ok:false, status:504 } : sitios(5));
  await probar("Fallan los tres", () => ({ ok:false, status:504 }));
})();
