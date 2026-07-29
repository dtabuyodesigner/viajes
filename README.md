# Viajes

Apps de viaje que funcionan **sin cobertura**, para usar en el móvil mientras se
conduce por sitios donde no hay línea.

**https://dtabuyodesigner.github.io/viajes/**

---

## Qué hay

```
/                     portada: elige viaje, sincroniza, actualiza, comparte
/eslovenia/           Eslovenia y Venecia, 18–29 julio 2026   (a medida)
/asturias/            Asturias occidental, 5 días             (a medida)
/crear/               editor: crear, pedir a una IA e importar viajes
/viaje/?id=xxx        visor de los viajes creados
/assets/app.js        motor común: lo que comparten las tres apps de viaje
/sync.js              nube, diario, fotos y documentos
/sql/                 SQL de las tablas, para pegar en Supabase
/tests/               72 comprobaciones + fotografías de comportamiento
```

Cada carpeta es una app independiente de **un solo archivo HTML** con su CSS y su
JavaScript dentro. Sin compilar, sin dependencias en producción.

| | líneas | peso |
|---|--:|--:|
| portada | 424 | 18 KB |
| editor | 1.356 | 60 KB |
| visor | 1.072 | 54 KB |
| Eslovenia | 2.281 | 134 KB |
| Asturias | 1.831 | 103 KB |
| **assets/app.js** | **1.096** | **46 KB** |
| sync.js | 828 | 30 KB |

---

## Los cuatro principios

**1. Manda el móvil, la nube es un espejo.**
Todo se guarda primero en el teléfono. La app va igual sin cobertura y sin
sesión. Supabase iguala cuando hay red.

**2. Ninguna espera es infinita.**
Toda llamada de red lleva tope de tiempo. Si algo no responde, se avisa **con el
motivo**, no con una frase amable. Un mensaje que no dice qué pasó cuesta horas
de diagnóstico: se aprendió por las malas.

**3. Se prueba antes de publicar, y se lee el resultado.**
`node tests/probar.js` y, si se movió código, `node tests/foto.js comparar`.
Los dos en verde **antes** de lanzar la subida, no en el mismo comando.

**4. Nunca se toca `main` directamente.**
Todo va a `dev`. A `main` solo lo que esté probado y cuando se pida.

---

## Empezar

```bash
npm install            # jsdom y fake-indexeddb, solo para las pruebas
node tests/probar.js   # las 72 en verde
node tests/foto.js comparar
```

---

## Qué sabe hacer cada app

|  | Portada | Eslovenia | Asturias | Visor | Editor |
|---|:--:|:--:|:--:|:--:|:--:|
| Día a día con paradas | | ● | ● | ● | |
| El primer vistazo del día | | ● | ● | ● | |
| Mapa del día y del viaje | | ● | ● | ● | |
| Navegación Waze + ver en mapa | | ● | ● | ● | |
| Marcar paradas y notas | | ● | ● | ● | |
| Fotos: cámara, galería y portada | | ● | ● | ● | |
| «Estoy aquí» y añadir sitios | | ● | ● | ● | |
| Dónde dormimos, con valoración | | ● | ● | ● | |
| Recorrido real en el mapa | | ● | ● | | |
| Alojamiento con sus enlaces | | ● | ● | ● | |
| Tarjetas de embarque | | ● | | | |
| Guía de lugares | | 39 fichas | 27 fichas | | |
| Reservas y localizadores | | ● | | ● | ● |
| Qué ver por aquí | | ● | ● | ● | |
| Servicios: cerca o de camino | | ● | ● | ● | |
| Tiempo real por carretera | | ● | ● | ● | |
| El tiempo | | ● | ● | ● | |
| Aviso de cercanía | | ● | ● | ● | |
| Crear, pedir a una IA, importar | | | | | ● |
| Sincronización | ● | ● | ● | ● | ● |
| Modo claro / automático / oscuro | ● | ● | ● | ● | ● |

---

## El motor común

`assets/app.js` tiene lo que era idéntico en las tres apps de viaje:

- **Ubicación**: `comoTexto` / `comoPar` (admite `"lat,lon"` y `[lat, lon]`),
  `ubicacionRapida` (pinta ya, afina después), `ubicacionFresca` (antes de cada
  búsqueda), `posActual`
- **Mapas**: `mapaDia`, `mapaCabecera`, `puntosDeRuta`, `xyDeParada`
- **Buscar**: `buscarServicios`, `buscarEnRuta`, `queVerCerca`, `porCarretera`
- **Guardar**: cámara y galería, portada del día, «Estoy aquí», pernoctas,
  documentos
- **Mostrar**: `bloqueHotel`, `frasesDelDia` (el primer vistazo)

Las apps aportan sus datos y sus piezas propias. Eslovenia tiene vuelos, seguros
y guía; Asturias, park4night; el visor, el editor detrás.

**Señal de que te estás pasando al unificar:** si hace falta un `if` con el
nombre del viaje dentro del motor, ese trozo no era común.

---

## Cómo se guardan los datos

### En el móvil

**`localStorage`** para lo pequeño: viajes propios, pendientes de subir, diario
por viaje, tema, preferencias de cada app.

**IndexedDB** (`viajes_fotos`) para lo que pesa:

| Registro | Se distingue por | Para qué |
|---|---|---|
| Foto del día | `dia >= 0` | galería y portada |
| Documento | `dia = -1` y campo `doc` | tarjetas de embarque |

Los identificadores llevan hora **y algo aleatorio**: dos archivos subidos
seguidos caen en el mismo milisegundo y el segundo pisaba al primero.

**Ojo con iOS:** cada app de la pantalla de inicio tiene su propio almacén. Hay
que iniciar sesión en cada una.

### En Supabase (`cmkzcvfjgrgxwqjimtxa`)

| Tabla | Qué guarda | Conflictos |
|---|---|---|
| `viajes` | un viaje por fila, días en `jsonb` | gana el más reciente |
| `viaje_diario` | marcas, notas, posiciones, visitas, pernoctas, portadas | **por entrada**, con marca de tiempo propia |
| `viaje_fotos` | fotos compartidas | por id, borrado lógico |

Las tarjetas de embarque **no** van a la nube: llevan nombre y código de barras.

### Forma de un viaje

```js
{
  id, nombre, desde, hasta, salida,
  normas: ["Andando sin acera se camina por la izquierda", …],
  dias: [{
    t, dest, xy, km, lluvia, foto,
    hotel: "Hotel Jägerhorn",              // nombre exacto, para buscarlo
    hotelWeb: "https://…",                 // solo si la IA la sabe de verdad
    paradas: [{ h, txt, c, n, mapa, w, xy, g, key, park }]
  }],
  reservas: { vuelos: [{ ruta, fecha, hora, cia, loc, vuelo, asientos, secuencia }],
              coche, telefonos }
}
```

### El diario, aparte

```js
{
  hechas, desmarcadas, notas,
  posiciones: { "5:0": {xy, ts} },                     // dónde estabas al marcar
  visitas:    [{ id, xy, ts, dia, txt, auto, manual }], // «estoy aquí»
  pernoctas:  [{ id, xy, ts, dia, txt, tipo, nota, valorada }],
  portadas:   { "5": {id, ts} }
}
```

---

## Reglas que no se saltan

**Si añades un archivo del que depende la app, dilo en los cinco `sw.js`.** Al
crear `assets/app.js` no se hizo, y desde el icono de inicio la app se quedaba a
medias: el service worker devolvía el HTML de la página donde iba un script.

**El código común se pide sin `?v=`.** La versión la lleva el service worker. Con
`?v=` la copia guardada nunca coincidía con la pedida.

**Recargar no aplica una versión nueva.** El service worker viejo manda hasta
cerrar todas las pestañas: hay que pedirle al nuevo que tome el mando
(`skipWaiting`) y recargar en `controllerchange`.

**`getRegistrations()` solo ve el sw de su carpeta.** Para limpiar todos hay que
recorrerlas con `getRegistration(ruta)`.

**Cada vista, sus propios identificadores.** Un día se dibuja dos veces —en Hoy y
en el detalle—; de ahí el parámetro `ctx` con valores `hoy` y `det`.

**No inventes URLs de terceros.** Si no se puede verificar el formato, usa una
búsqueda. Ya se publicaron 34 enlaces de Wikiloc que daban 404.

**Cambiar la lógica obliga a revisar los textos.** «Buscando en 5 km» en un modo
sin radio es peor que no decir nada.

**Nada de colores fijos en lo estructural**, o el modo claro se rompe. Hay una
prueba que lo vigila.

---

## Servicios externos

Ninguno necesita clave.

| Para qué | Cómo |
|---|---|
| Navegar | `waze://?q=` y `?ll=`, con `maps/search` para ver |
| Rutas a pie | `wikiloc://` y `map.do?q=` |
| Dormir en furgo | `p4n://` y `park4night.com` |
| Qué es un sitio | Wikipedia y Wikivoyage, `origin=*` |
| Qué hay cerca | Overpass · **tres servidores con reintentos** |
| Tiempo por carretera | OSRM `table/v1/driving` |
| Cómo se llama esto | Nominatim `reverse` |
| Buscar un sitio | Nominatim `search` |
| El tiempo | Open-Meteo |
| Sincronizar | Supabase |

---

## Las pruebas

**`node tests/probar.js`** — 72 comprobaciones: que cada app carga y pinta, que
no hay funciones sin definir, que el tema claro no rompe nada, que cada vista
tiene sus ids, que la ubicación vale en sus dos formatos.

**`node tests/foto.js`** — guarda el HTML de 34 vistas y lo compara después de
mover código. Es lo que hace seguro refactorizar.

Y pruebas sueltas para lo que costó acertar: `posicion.js`, `ruta-delante.js`,
`ubicacion-fresca.js`, `ubicacion-rapida.js`, `documentos.js`, `quever.js`,
`hotel.js`.

**Una prueba que nunca has visto fallar no sirve.** Después de escribirla,
reintroduce el fallo y comprueba que salta.

---

## Lo que falta

Ver `PENDIENTE.md`. `AGENTS.md` si quien toca esto es una IA. `USO.md` para
usarla sin saber programar.
