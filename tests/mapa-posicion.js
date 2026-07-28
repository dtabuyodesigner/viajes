const fs = require('fs');
const M = fs.readFileSync('/home/claude/viaje/assets/app.js','utf8');
const trozo = re => (M.match(re) || [""])[0];
const base = ["comoTexto","comoPar","xyDeParada"]
  .map(n => trozo(new RegExp("function " + n + "[\\s\\S]*?\\n\\}"))).join("\n");

function probar(nombre, MI_POS){
  const VIAJE = { dias:[{ xy:"46.281,14.322", paradas:[
    { xy:"46.368,14.095" }, { xy:"46.363,14.096" } ]}]};
  const ctx = { VIAJE, LUGARES:{}, MI_POS, DIARIO_SYNC:undefined, VIAJE_ID:"x" };
  try {
    const fn = new Function(...Object.keys(ctx),
      base + "\n" + trozo(/function mapaDia[\s\S]*?\n\}\n/) + "\nreturn mapaDia;");
    const html = fn(...Object.values(ctx))(0, "hoy");
    console.log(`  ${nombre.padEnd(28)} mapa:${html.length > 200 ? "sí" : "NO "}  punto azul:${/class="yo"/.test(html) ? "sí" : "no"}  paradas:${(html.match(/class="pp"/g)||[]).length}`);
  } catch(e){ console.log(`  ${nombre.padEnd(28)} ✗ ${e.message}`); }
}
console.log("═══ MAPA DEL DÍA ═══");
probar("posición en lista", [46.30, 14.20]);
probar("posición en texto", "46.30,14.20");
probar("sin posición", null);
