const fs = require('fs');
const MOTOR = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');

// Un día como los de verdad: unas paradas con xy, otras con ficha
const VIAJE = { dias: [{
  t:"El icónico lago Bled", xy:"46.281,14.322",
  paradas: [
    { txt:"Mirador Ojstrica", g:"ojstrica" },
    { txt:"Barca a la isla",  xy:"46.363,14.096" },
    { txt:"Garganta de Vintgar", g:"vintgar" },
    { txt:"Comer en Bled" }                      // sin coordenadas
  ]}]};
const LUGARES = {
  ojstrica: { xy:"46.368,14.095" },
  vintgar:  { xy:"46.393,14.058" }
};
let MIPOS = "46.290,14.310";
const distancia = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]) * 111;

const ctx = { VIAJE, LUGARES, MIPOS, distancia, VIAJE_ID:"x" };
const fn = new Function(...Object.keys(ctx),
  MOTOR.match(/function xyDeParada[\s\S]*?\n\}/)[0] + "\n" +
  MOTOR.match(/function puntosDeRuta[\s\S]*?\n\}/)[0] +
  "\nreturn { puntosDeRuta, xyDeParada };");
const { puntosDeRuta, xyDeParada } = fn(...Object.values(ctx));

console.log("═══ PUNTOS DE LA RUTA DEL DÍA ═══");
const p = puntosDeRuta(0);
console.log("  encontrados:", p.length);
p.forEach(x => console.log("   ", x.join(", ")));
console.log("\n  esperado: tu posición + 2 fichas + 1 xy propio + el alojamiento = 5");
console.log("  ¿correcto?", p.length === 5 ? "sí" : "NO");

console.log("\n═══ CADA PARADA ═══");
VIAJE.dias[0].paradas.forEach(x =>
  console.log("  ", x.txt.padEnd(22), xyDeParada(x) || "(sin coordenadas)"));
