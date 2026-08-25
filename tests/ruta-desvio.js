const fs = require('fs');
const path = require('path');
const MOTOR = fs.readFileSync(path.join(__dirname, '..', 'assets/app.js'),'utf8');

// Ruta de Naklo a Bled; sitios a distintas distancias del camino
const VIAJE = { dias: [{ xy:"46.281,14.322", paradas:[
  { xy:"46.290,14.310" }, { xy:"46.363,14.096" }, { xy:"46.393,14.058" }
]}]};
const LUGARES = {}; let MIPOS = "46.290,14.310";
const distancia = (a,b) => {
  const R=6371, r=x=>x*Math.PI/180;
  const dLat=r(b[0]-a[0]), dLon=r(b[1]-a[1]);
  const h=Math.sin(dLat/2)**2+Math.cos(r(a[0]))*Math.cos(r(b[0]))*Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(h));
};

const SITIOS = [
  { lat:46.365, lon:14.100, name:"Petrol Bled (al lado del camino)" },
  { lat:46.300, lon:14.300, name:"OMV Naklo (junto al inicio)" },
  { lat:46.500, lon:14.450, name:"Lejos al norte" },
  { lat:46.180, lon:13.920, name:"Lejos al suroeste" },
  { lat:46.380, lon:14.150, name:"A media hora del camino" }
];

const fetch = async () => ({ ok:true, json: async () => ({
  elements: SITIOS.map(s => ({ lat:s.lat, lon:s.lon, tags:{ name:s.name } })) })});

const ctx = { VIAJE, LUGARES, MIPOS, distancia, fetch,
              navigator: { geolocation: { getCurrentPosition: (ok, mal) => mal() } },
              Promise, AbortController, setTimeout, clearTimeout, Math, Error, encodeURIComponent };
const fn = new Function(...Object.keys(ctx),
  MOTOR.match(/function comoTexto[\s\S]*?\n\}/)[0] + "\n" +
  MOTOR.match(/function comoPar[\s\S]*?\n\}/)[0] + "\n" +
  MOTOR.match(/function xyDeParada[\s\S]*?\n\}/)[0] + "\n" +
  MOTOR.match(/function puntosDeRuta[\s\S]*?\n\}/)[0] + "\n" +
  MOTOR.match(/async function ubicacionFresca[\s\S]*?\n\}/)[0] + "\n" +
  MOTOR.match(/async function buscarEnRuta[\s\S]*?\n\}\n/)[0] + "\nreturn buscarEnRuta;");
const buscarEnRuta = fn(...Object.values(ctx));

(async () => {
  console.log("═══ QUÉ DEVUELVE, Y CON QUÉ DESVÍO ═══");
  const r = await buscarEnRuta({ q:'node["amenity"="fuel"]', n:"Gasolinera" }, 0, 10);
  r.forEach(x => console.log(`  ${x.desvio.toFixed(1).padStart(5)} km  ${x.nombre}`));
  console.log("\n  descartados por quedar lejos del camino:",
    SITIOS.length - r.length, "de", SITIOS.length);
  console.log("  ordenados por lo próximo que lo pillas:",
    r.every((x,k) => k===0 || r[k-1].desdeAqui <= x.desdeAqui) ? "sí" : "NO");
})();
