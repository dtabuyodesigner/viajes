const fs = require('fs');
const M = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');
const trozo = re => (M.match(re) || [""])[0];
const distancia = (a,b) => {
  const R=6371, r=x=>x*Math.PI/180;
  const dLat=r(b[0]-a[0]), dLon=r(b[1]-a[1]);
  const h=Math.sin(dLat/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

// Día de Cerklje a Venecia
const VIAJE = { dias:[{ xy:"45.4900,12.2400", paradas:[
  { xy:"46.2500,14.4900" }, { xy:"46.0500,14.5100" },
  { xy:"45.8000,13.6000" }, { xy:"45.5052,12.3235" } ]}]};

const GAS = [
  { lat:46.2400, lon:14.4600, name:"Kranj (ya pasada)" },
  { lat:45.8100, lon:13.6200, name:"Gorizia (por delante)" },
  { lat:45.7000, lon:13.4000, name:"Monfalcone (por delante)" },
  { lat:45.5100, lon:12.3300, name:"Venecia (a 150 km)" }
];

async function probar(nombre, guardada, ahora){
  let MIPOS = guardada;
  const opciones = [];
  const navegador = { geolocation: { getCurrentPosition(ok, mal, o){
    opciones.push(o);
    setTimeout(() => ok({ coords:{ latitude:ahora[0], longitude:ahora[1] } }), 5);
  }}};
  const guardaPosicion = par => { MIPOS = par; };
  const fetch = async () => ({ ok:true, json: async () => ({
    elements: GAS.map(g => ({ lat:g.lat, lon:g.lon, tags:{ name:g.name } })) })});

  const ctx = { get MIPOS(){ return MIPOS; }, LUGARES:{}, miPos:undefined, VIAJE,
                distancia, fetch, guardaPosicion, navigator:navegador,
                AbortController, setTimeout, clearTimeout, Math, Error, Promise, encodeURIComponent };
  const fn = new Function(...Object.keys(ctx),
    trozo(/function comoTexto[\s\S]*?\n\}/) + "\n" +
    trozo(/function comoPar[\s\S]*?\n\}/) + "\n" +
    trozo(/function xyDeParada[\s\S]*?\n\}/) + "\n" +
    trozo(/function puntosDeRuta[\s\S]*?\n\}/) + "\n" +
    trozo(/async function ubicacionFresca[\s\S]*?\n\}/) + "\n" +
    trozo(/async function buscarEnRuta[\s\S]*?\n\}\n/) + "\nreturn buscarEnRuta;");
  const r = await fn(...Object.values(ctx))({ q:'node["amenity"="fuel"]', n:"Gasolinera" }, 0, 10);
  console.log(`\n  ${nombre}`);
  console.log(`     pide ubicación fresca: ${opciones.length ? "sí, máx " + opciones[0].maximumAge/1000 + " s de antigüedad" : "NO"}`);
  r.forEach(x => console.log(`     ${x.desdeAqui.toFixed(0).padStart(3)} km  ${x.nombre}`));
  if (!r.length) console.log("     (ninguna)");
}

(async () => {
  console.log("═══ LA APP CREE QUE SIGUES EN CERKLJE, PERO YA ESTÁS EN GORIZIA ═══");
  await probar("Con la posición vieja guardada", [46.25, 14.49], [45.81, 13.62]);
})();
