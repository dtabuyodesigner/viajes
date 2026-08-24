# Viajes

Apps de viaje que funcionan **sin cobertura**, para usar en el móvil mientras se
conduce por sitios donde no hay línea.

**https://dtabuyodesigner.github.io/viajes/**

---

## Qué hay

```
/                     portada: elige viaje, sincroniza, actualiza, comparte
/eslovenia/           Eslovenia y Venecia, 18–29 julio 2026
/eslovenia/datos.js     …sus datos: días, guía, vuelos, seguros, info
/asturias/            Asturias occidental, 5 días
/asturias/datos.js      …sus datos: días, guía, park4night, info
/crear/               editor: crear, editar, pedir a una IA e importar
/viaje/?id=xxx        visor de los viajes creados
/assets/app.js        motor común: lo que comparten las apps de viaje
/sync.js              nube, diario, fotos y documentos
/sql/                 SQL de las tablas, para pegar en Supabase
/tests/               391 comprobaciones + fotografías de comportamiento
```

Cada carpeta es una app sin compilar y sin dependencias en producción. Los dos
viajes escritos a mano ya no llevan sus datos dentro: el HTML pone la estructura,
`assets/app.js` el motor y `datos.js` el viaje. **Un viaje nuevo es un archivo de
datos, no una app entera.**

| | líneas | peso |
|---|--:|--:|
| portada | 424 | 18 KB |
| editor | 1.356 | 60 KB |
| visor | 1.072 | 54 KB |
| Eslovenia | 1.912 | — |
| …sus datos | 381 | — |
| Asturias | 1.563 | — |
| …sus datos | 281 | — |
| **assets/app.js** | **1.176** | — |
| sync.js | 845 | — |

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
node tests/probar.js   # las 391 en verde
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
| Guía de lugares | | 40 fichas | 27 fichas | | |
| Reservas y localizadores | | ● | | ● | ● |
| Editar el viaje desde el móvil | | ● | ● | ● | ● |
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

`assets/app.js` tiene lo que era idéntico en las apps de viaje:

- **Ubicación**: `comoTexto` / `comoPar` (admite `"lat,lon"` y `[lat, lon]`),
  `ubicacionRapida` (pinta ya, afina después), `ubicacionFresca` (antes de cada
  búsqueda), `posActual`
- **Mapas**: `mapaDia`, `mapaCabecera`, `puntosDeRuta`, `xyDeParada`
- **Buscar**: `buscarServicios`, `buscarEnRuta`, `queVerCerca`, `porCarretera`
- **Guardar**: cámara y galería, portada del día, «Estoy aquí», pernoctas,
  documentos
- **Mostrar**: `bloqueHotel`, `frasesDelDia` (el primer vistazo), `indexaGuia`
- **Qué viaje manda**: `viajeEnUso(id, delArchivo)` pone la copia guardada en el
  móvil encima de la del archivo, **fusionando**: lo que la copia no traiga se
  queda como está en el archivo
- **Llevar el viaje al editor**: `dejaTraspaso` lo deja para la otra app y el
  editor deja acuse de recibo; `traspasoSinRecoger` detecta que no llegó

Las apps aportan sus datos y sus piezas propias. Eslovenia tiene vuelos, seguros
y tarjetas de embarque; Asturias, park4night; el visor, el editor detrás.

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
| `viajes` | un viaje por fila, días en `jsonb`, el resto en `extra` | gana el más reciente, **fundiendo**: lo que la nube no lleve no se borra |
| — | borrados pendientes en `viajes_borrados` | se reintentan hasta que el servidor confirma: un viaje borrado sin cobertura no resucita |
| `viaje_diario` | marcas, notas, posiciones, visitas, pernoctas, portadas | **por entrada**, con marca de tiempo propia |
| `viaje_fotos` | fotos compartidas | por id, borrado lógico |

Las tarjetas de embarque **no** van a la nube: llevan nombre y código de barras.

### Forma de un viaje

Solo `id`, `nombre` y `dias` hacen falta. **Todo lo demás es opcional**: un viaje
sin guía, sin vuelos o sin información se abre igual, y las pestañas que no
tienen nada que enseñar salen vacías en vez de romperse.

```js
{
  id, nombre, desde, hasta, salida,
  normas: ["Andando sin acera se camina por la izquierda", …],

  dias: [{
    t, dest, xy, km, lluvia, foto,
    hotel: "Hotel Jägerhorn",              // nombre exacto, para buscarlo
    hotelWeb: "https://…",                 // solo si se sabe de verdad
    f: "2026-07-18",                       // fecha propia del día, si la tiene
    d: 1,                                  // o su número, si el viaje no tiene fechas
    arte: "cueva", base: "Brne Rooms · Postojna",   // ilustración y rótulo
    paradas: [{ h, txt, c, n, mapa, w, xy, g, key, park }]
  }],

  // Bloques opcionales. Los usa quien los tenga.
  guia: [{ zona, arte, nota, lugares: [{ id, xy, n, t, d, k, m, tip, wl }] }],
  info: { clave: [[etiqueta, texto], …] },
  vuelos: [{ ruta, fecha, hora, cia, loc, vuelo, terminal, puerta, asientos, secuencia }],
  acceso: { cia, email, url },
  coche: { proveedor, reserva, recogida, devolucion, telefono, franquicia, … },
  seguros: [{ nombre, poliza, limite, que, no }],
  telefonos: [{ q, sub, n, wa, urgente }],
  alojamientos: [{ fechas, nombre, zona }],

  // Y lo que se invente mañana: ni el editor ni la nube lo tiran.
  reservas: { vuelos, coche, telefonos }   // forma antigua, se sigue leyendo
}
```

**Una parada apunta a su ficha de la guía con `g`**, que es el `id` del lugar.
`xyDeParada()` usa las coordenadas de la ficha si la parada no trae las suyas.

**Los campos que no se reconocen se conservan.** El editor parte del viaje que
recibe y solo pone en su sitio lo que sabe; la nube manda en la columna `extra`
todo lo que no tiene columna propia. Abrir un viaje y guardarlo sin tocarlo lo
devuelve entero: hay una prueba que lo vigila campo por campo.

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
Ahora hay una prueba que lo caza, pero la regla sigue siendo la misma.

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

**Cómo está el viaje se decide en un solo sitio.** `comoEstaTodo()` y
`resumenDeEstado()` en `sync.js` responden a una sola pregunta: ¿qué está subido
y qué no? Las cinco apps pintan ese mismo modelo:
la portada con detalle completo, el editor y los tres viajes con una línea que
se abre. Nada de correos, tablas ni códigos de error.

**Ninguna frase promete por lo que no se puede comprobar.** El diario no tiene
cola de pendientes: cada gesto hace `subir().catch()` y un fallo no deja rastro,
así que **no se sabe** si llegó al otro móvil. Por eso el resumen verde dice
«Viajes y fotos al día» y no «a salvo» ni «todo sincronizado» — una frase así
estaría respondiendo también por las notas, las marcas y las pernoctas. El diario
tiene su propia fila en el detalle diciendo lo que hay. Una prueba recorre el
texto visible de las cinco apps buscando garantías de más.

Tampoco hay hora de última sincronización: la marca `actualizado` la pone siempre
el propio móvil antes de mandar, y no existe ninguna confirmada por el servidor.

**«Preparado sin cobertura» se afirma con evidencia.** Se comprueba que existe la
caché de cada app y que dentro está su página, buscando por prefijo porque los
nombres llevan versión. `caches` es por origen, así que la portada las ve las
cinco. No promete que estén todas las fotos: eso solo se guarda al visitarlas.

**Las búsquedas tienen plazo y se pueden parar.** Un solo plazo desde el toque
—`PRESUPUESTO_BUSQUEDA`, 30 s— que cubre GPS y servidores de mapas hasta los
primeros resultados. Cambiar de servidor **no reinicia el reloj**. Mientras
busca hay un botón de **Cancelar** que aborta las peticiones de verdad.

Los tiempos por carretera van **después y aparte**, con su propio límite corto:
para entonces los resultados ya están en pantalla y ya sirven. Si fallan, si se
cancelan o si tardan, la lista se queda como está y solo cambia la nota de
abajo. Nunca se sustituyen resultados válidos por un mensaje de error.

Además del `AbortController` hay una **generación** de búsqueda, porque hay cosas
que no se pueden abortar: el GPS no tiene cancelación, y una respuesta vieja
puede llegar cuando ya se ha pedido otra categoría. Comparando la generación se
sabe si lo que llega sigue valiendo o hay que tirarlo.

**Ningún botón puede quedarse esperando.** `conTope()` y `fetchConTope()` en
`sync.js` ponen límite a todo lo que va por red, y `trabajando()` se encarga del
botón: lo desactiva mientras trabaja, lo anuncia con `aria-busy`, y lo devuelve
a su texto **también cuando falla**, enseñando el motivo real.

**El almacén de una app instalada en iOS no es el de Safari.** WebKit lo tiene
documentado como intencional (bug 181849). Por eso llevar un viaje de
`/eslovenia/` a `/crear/` no se da por hecho: se deja un traspaso, el editor deja
acuse de recibo, y si no llega se dice en vez de abrir un viaje en blanco. **No
hay ningún almacén del navegador que escape a ese aislamiento**: IndexedDB, Cache
y `sessionStorage` se parten igual.

**Un error del servidor no es una columna que falta.** Solo se deja de mandar
`extra` cuando el error lo identifica (`PGRST204`, o el mensaje de la columna).
Con cualquier otro fallo el viaje queda pendiente y se reintenta entero.

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

**`node tests/probar.js`** — 391 comprobaciones: que cada app carga y pinta, que
no hay funciones sin definir, que el tema claro no rompe nada, que cada vista
tiene sus ids, que la ubicación vale en sus dos formatos, que **lo que carga una
app está en su service worker**, que **la nube no borra bloques del viaje**, que
**abrir y guardar en el editor conserva el viaje entero**, y que Eslovenia y
Asturias se pueden editar sin perder su guía.

**`node tests/foto.js`** — guarda el HTML de 51 vistas y lo compara después de
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
