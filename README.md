# Viajes

Apps de viaje que funcionan **sin cobertura**, pensadas para usarse en el móvil
mientras se conduce por sitios donde no hay línea.

Publicado en **https://dtabuyodesigner.github.io/viajes/**

---

## Qué hay aquí

```
/                     portada: elige viaje, sincroniza y actualiza
/eslovenia/           viaje a Eslovenia y Venecia, julio 2026 (a medida)
/asturias/            viaje a Asturias occidental (a medida)
/crear/               editor: crear y editar viajes propios
/viaje/?id=xxx        visor de los viajes creados
/sync.js              sincronización con Supabase (compartido)
/img/                 dibujos y mapas
/tests/probar.js      pruebas automáticas
```

Cada carpeta es una app independiente de **un solo archivo HTML**, con su CSS y
su JavaScript dentro. Sin compilar, sin dependencias, sin `node_modules`.
Se abre el archivo y funciona.

---

## Los tres principios

**1. Manda el móvil, la nube es un espejo.**
Todo se guarda primero en `localStorage` y la app va igual sin cobertura y sin
sesión. Supabase iguala cuando hay red. Si la nube falla, no se entera nadie.

**2. Ninguna espera es infinita.**
Toda llamada de red lleva tope de tiempo. Si algo no responde, se avisa. Nunca
se deja un botón en «Cargando…» para siempre. Ver `conTope()` en `sync.js`.

**3. Se prueba antes de publicar.**
`node tests/probar.js` antes de cada subida. Sin excepciones.

---

## Antes de tocar nada

```bash
npm install jsdom      # única dependencia, solo para las pruebas
node tests/probar.js   # deben salir las 40 comprobaciones en verde
```

## Trabajar

Los cambios van a la rama `dev`. A `main` solo lo que esté probado, porque
`main` es lo que hay publicado y puede estar usándose en carretera ahora mismo.

```bash
git checkout dev
# ...cambios...
node tests/probar.js
git commit -am "qué se ha hecho"
git checkout main && git merge dev && git push
```

---

## Cómo se guardan los datos

### En el móvil (`localStorage`)

| Clave | Qué guarda |
|---|---|
| `viajes_propios` | los viajes creados, como lista de objetos |
| `viajes_pendientes` | ids que faltan por subir a la nube |
| `diario_<viaje>` | paradas marcadas y notas de ese viaje |
| `gen_app`, `gen_tema` | preferencias del visor |
| `eslo_*`, `astu_*` | preferencias de las apps a medida |

### En Supabase (proyecto `cmkzcvfjgrgxwqjimtxa`)

**`viajes`** — un viaje por fila, los días en `jsonb`.
**`viaje_diario`** — marcas y notas, con marca de tiempo por entrada.

El SQL de ambas está en `/sql/`. Las políticas son abiertas para quien haya
iniciado sesión: son dos personas que comparten todo.

### Forma de un viaje

```js
{
  id: "v1a2b3c",
  nombre: "Croacia en círculo",
  desde: "2026-09-05",        // vacío = días numerados en vez de fechas
  hasta: "2026-09-12",
  salida: "San Miguel de las Dueñas",
  actualizado: "2026-07-25T18:00:00Z",
  dias: [{
    t: "Llegada a Zagreb",     // título de la jornada
    dest: "Zagreb",            // dónde se duerme: es el destino de navegación
    km: "135 km · 2 h",        // opcional
    lluvia: "Museo de …",      // plan B, opcional
    foto: "data:image/jpeg…",  // opcional, comprimida a ~900 px
    paradas: [{
      h: "Mañana",             // opcional
      txt: "Lagos de Plitvice",
      n: "Entra por la puerta 2, reserva online",
      mapa: "Plitvicka Jezera ulaz 2",   // lo que se le pasa al navegador
      key: true                // imprescindible del día
    }]
  }],
  reservas: {
    vuelos: [{ ruta, fecha, hora, cia, loc, n }],
    coche: { empresa, reserva, recogida, devolucion, telefono },
    telefonos: [{ q, n }]
  }
}
```

---

## Reglas que no se saltan

**El caché puede dejarte la app vieja.** Por eso `sync.js` va con `?v=NN` en la
URL y está excluido del service worker. Si tocas `sync.js`, **sube el número**
en las tres páginas que lo cargan, o la gente seguirá con la versión antigua.

**La versión se ve en pantalla.** `const VERSION` en la portada y en las apps a
medida. Súbela en cada publicación: es lo que permite saber si el móvil tiene lo
último.

**Nada de claves de API en el repositorio.** Es público. La clave anónima de
Supabase sí puede estar: está pensada para ser pública y la protege el RLS.

**Los enlaces se verifican antes de publicarlos.** Ya pasó: se subieron 34
enlaces de Wikiloc con un formato que daba 404. Si no se puede comprobar, no se
sube.

**Nunca `localStorage` sin `try/catch`.** En modo privado de iOS lanza excepción
y tumbaría la app entera.

---

## Servicios externos

| Para qué | Cómo | Clave |
|---|---|---|
| Navegar | `waze://?q=` y `?ll=`, con Google Maps de respaldo | no |
| Rutas a pie | `wikiloc://` y `es.wikiloc.com/wikiloc/map.do?q=` | no |
| Dormir en furgo | `p4n://` y `park4night.com` | no |
| Qué es un sitio | API de Wikipedia con `origin=*` | no |
| Qué hacer allí | API de Wikivoyage con `origin=*` | no |
| Qué hay cerca | Overpass (OpenStreetMap) | no |
| Sincronizar | Supabase | anónima, pública |

Los esquemas `waze://`, `p4n://` y `wikiloc://` están **comprobados en un iPhone
real**. No están documentados por sus fabricantes: si dejan de funcionar, hay
que volver a probarlos a mano.

---

## Lo que falta

Ver `PENDIENTE.md`.
