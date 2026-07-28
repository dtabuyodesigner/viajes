const fs = require('fs');
const M = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');
const trozo = re => (M.match(re) || [""])[0];
const distancia = (a,b) => {
  const R=6371, r=x=>x*Math.PI/180;
  const dLat=r(b[0]-a[0]), dLon=r(b[1]-a[1]);
  const h=Math.sin(dLat/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

const VIAJE = { dias:[{ xy:"45.4900,12.2400", paradas:[
  { xy:"46.2500,14.4900" }, { xy:"46.0500,14.5100" },
  { xy:"45.8000,13.6000" }, { xy:"45.5052,12.3235" } ]}]};

// Gasolineras: unas cerca de donde estás, otras en Italia
const GASOLINERAS = [
  { lat:46.2400, lon:14.4600, name:"Petrol Kranj (cerca)" },
  { lat:46.1500, lon:14.4900, name:"OMV Vodice (de camino)" },
  { lat:46.0400, lon:14.5200, name:"Petrol Liubliana" },
  { lat:45.5100, lon:12.3300, name:"Q8 Venecia (a 180 km)" },
  { lat:45.5000, lon:12.3100, name:"Total Mestre (a 180 km)" }
];

const fetch = async () => ({ ok:true, json: async () => ({
  elements: GASOLINERAS.map(g => ({ lat:g.lat, lon:g.lon, tags:{ name:g.name } })) })});

const ctx = { VIAJE, LUGARES:{}, MIPOS:[46.25, 14.49], miPos:undefined, distancia, fetch,
              AbortController, setTimeout, clearTimeout, Math, Error, encodeURIComponent };
const fn = new Function(...Object.keys(ctx),
  trozo(/function comoTexto[\s\S]*?\n\}/) + "\n" +
  trozo(/function comoPar[\s\S]*?\n\}/) + "\n" +
  trozo(/function xyDeParada[\s\S]*?\n\}/) + "\n" +
  trozo(/function puntosDeRuta[\s\S]*?\n\}/) + "\n" +
  trozo(/async function buscarEnRuta[\s\S]*?\n\}\n/) + "\nreturn buscarEnRuta;");

(async () => {
  const r = await fn(...Object.values(ctx))({ q:'node["amenity"="fuel"]', n:"Gasolinera" }, 0, 10);
  console.log("═══ SALIENDO DE CERKLJE HACIA VENECIA ═══\n");
  r.forEach(x => console.log(
    `  ${x.desdeAqui.toFixed(0).padStart(3)} km de ti · ${x.desvio.toFixed(1).padStart(4)} km de desvío   ${x.nombre}`));
  console.log(`\n  descartadas: ${GASOLINERAS.length - r.length} de ${GASOLINERAS.length}`);
  console.log("  las de Venecia (180 km) fuera:",
    r.some(x => x.nombre.includes("180")) ? "NO ✗" : "sí ✓");
})();
