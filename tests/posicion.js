const fs = require('fs');
const M = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');

function probar(nombre, MIPOS, miPos){
  const distancia = (a,b) => Math.hypot(a[0]-b[0], a[1]-b[1]) * 111;
    const VIAJE = { dias:[{ xy:"46.281,14.322", paradas:[
    { xy:"46.368,14.095" }, { g:"vintgar" }, { txt:"sin coords" } ]}]};
  const LUGARES = { vintgar:{ xy:"46.393,14.058" } };
  const ctx = { VIAJE, LUGARES, MIPOS, miPos, Number, Array, String };
  const fn = new Function(...Object.keys(ctx),
    M.match(/function comoTexto[\s\S]*?\n\}/)[0] + "\n" +
    M.match(/function comoPar[\s\S]*?\n\}/)[0] + "\n" +
    M.match(/function xyDeParada[\s\S]*?\n\}/)[0] + "\n" +
    M.match(/function puntosDeRuta[\s\S]*?\n\}/)[0] + "\nreturn puntosDeRuta;");
  try {
    const p = fn(...Object.values(ctx))(0);
    console.log(`  ${nombre.padEnd(34)} ${p.length} puntos  ${JSON.stringify(p[0])}`);
  } catch(e){ console.log(`  ${nombre.padEnd(34)} ✗ ${e.message}`); }
}

console.log("═══ LA POSICIÓN, EN SUS DOS FORMAS ═══");
probar("array [46.3, 14.1]  (Eslovenia)", [46.36, 14.11], undefined);
probar("texto \"46.3,14.1\"   (el visor)", undefined, "46.36,14.11");
probar("sin ubicación todavía",           null, null);
probar("array con basura",                ["x","y"], null);
probar("texto mal formado",               undefined, "hola");
