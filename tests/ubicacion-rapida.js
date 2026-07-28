const fs = require('fs');
const M = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');
const trozo = re => (M.match(re) || [""])[0];

// El móvil: tiene una posición aproximada al momento, y el GPS tarda 6 s
function navegadorSimulado(){
  const llamadas = [];
  return { llamadas, geolocation: { getCurrentPosition(ok, mal, o){
    llamadas.push({ alta: o.enableHighAccuracy, espera: o.timeout, edad: o.maximumAge });
    if (!o.enableHighAccuracy)
      setTimeout(() => ok({ coords:{ latitude:45.43, longitude:12.33 } }), 200);   // wifi: rápido
    else
      setTimeout(() => ok({ coords:{ latitude:45.4341, longitude:12.3388 } }), 6000); // gps: lento
  }}};
}

(async () => {
  const nav = navegadorSimulado();
  const ctx = { navigator: nav, Promise, setTimeout, Array };
  const fn = new Function(...Object.keys(ctx),
    trozo(/function ubicacionRapida[\s\S]*?\n\}/) + "\nreturn ubicacionRapida;");
  const t0 = Date.now();
  const p = await fn(...Object.values(ctx))();
  const ms = Date.now() - t0;
  console.log("═══ SITUARSE EN EL MAPA ═══");
  console.log(`  tarda: ${ms} ms`);
  console.log(`  posición: ${p.map(x => x.toFixed(4)).join(", ")}`);
  console.log(`  peticiones lanzadas: ${nav.llamadas.length}`);
  nav.llamadas.forEach(l => console.log(`     precisión ${l.alta ? "alta" : "normal"} · espera ${l.espera/1000} s · admite hasta ${l.edad/1000} s de antigüedad`));
  console.log(`\n  ¿responde antes de 1 segundo? ${ms < 1000 ? "sí ✓" : "NO, tarda " + ms + " ms"}`);
})();
