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
/sync.js              nube, diario y fotos: compartido por todas
/assets/app.js        motor común: cámara, mapas, tiempo, «estoy aquí»
/img/  /fotos/        dibujos, mapas y fotos
/sql/                 SQL de las tablas, para pegar en Supabase
/tests/probar.js      68 comprobaciones automáticas
```

Cada carpeta es una app independiente de **un solo archivo HTML** con su CSS y su
JavaScript dentro. Sin compilar, sin dependencias, sin `node_modules` en
producción. Se abre el archivo y funciona.

| | líneas | peso |
|---|--:|--:|
| portada | 375 | 16 KB |
| editor | 1.294 | 57 KB |
| visor | 1.177 | 56 KB |
| Eslovenia | 2.453 | 139 KB |
| Asturias | 2.042 | 110 KB |
| sync.js | 722 | 26 KB |
| assets/app.js | 431 | 15 KB |

---

## Los tres principios

**1. Manda el móvil, la nube es un espejo.**
Todo se guarda primero en el propio teléfono. La app va igual sin cobertura y sin
sesión. Supabase iguala cuando hay red. Si la nube falla, no se entera nadie.

**2. Ninguna espera es infinita.**
Toda llamada de red lleva tope de tiempo (`conTope()` en `sync.js`). Si algo no
responde, se avisa. Nunca se deja un botón en «Cargando…» para siempre.

**3. Se prueba antes de publicar, y se publica en `dev`.**
`node tests/probar.js` antes de cada subida. A `main` solo lo pedido y probado.

---

## Empezar

```bash
npm install            # jsdom y fake-indexeddb, solo para las pruebas
node tests/probar.js   # deben salir las 68 comprobaciones en verde
```

Los cambios van a `dev`. A `main` solo lo probado: `main` es lo publicado y puede
estar usándose en carretera ahora mismo.

---

## Qué sabe hacer cada app

|  | Portada | Eslovenia | Asturias | Visor | Editor |
|---|:--:|:--:|:--:|:--:|:--:|
| Día a día con paradas | | ● | ● | ● | |
| Navegación Waze + ver en mapa | | ● | ● | ● | |
| Mapa del día y del viaje | | ● | ● | ● | |
| Marcar paradas y notas | | ● | ● | ● | |
| Fotos: cámara, galería y portada | | ● | ● | ● | |
| «Estoy aquí» y añadir sitios | | ● | ● | ● | |
| Dónde dormimos, con valoración | | ● | ● | ● | |
| Recorrido real en el mapa | | ● | ● | | |
| Guía de lugares | | 39 fichas | 27 fichas | | |
| Reservas y localizadores | | ● | | ● | ● |
| Qué tengo cerca | | ● | ● | ● | |
| Servicios (OpenStreetMap) | | ● | ● | ● | |
| Qué ver por aquí | | ● | ● | ● | |
| Tiempo real por carretera | | ● | ● | ● | |
| El tiempo | | ● | ● | ● | |
| Aviso de cercanía | | ● | ● | ● | |
| El primer vistazo del día | | ● | ● | ● | |
| park4night | | | ● | | |
| Crear, pedir a una IA, importar | | | | | ● |
| Sincronización | ● | ● | ● | ● | ● |
| Modo claro / automático / oscuro | ● | ● | ● | ● | ● |

---

## Cómo se guardan los datos

### En el móvil

**`localStorage`** para lo pequeño:

| Clave | Qué guarda |
|---|---|
| `viajes_propios` | los viajes creados |
| `viajes_pendientes` | ids que faltan por subir |
| `diario_<viaje>` | marcas, notas, posiciones, visitas y portadas |
| `fotos_pendientes` | fotos que faltan por subir |
| `tema_viajes` | `auto`, `claro` u `oscuro`, compartido por todas |
| `nav_*` / `ast_*` / `gen_*` | preferencias de cada app |

**IndexedDB** (`viajes_fotos`) para las fotos: en `localStorage` solo caben unos
5 MB y tres fotos ya lo llenarían.

**Ojo con iOS:** cada app añadida a la pantalla de inicio tiene **su propio
almacén**, aunque el dominio sea el mismo. Por eso hay que iniciar sesión en cada
una por separado.

### En Supabase (proyecto `cmkzcvfjgrgxwqjimtxa`)

| Tabla | Qué guarda | Cómo resuelve conflictos |
|---|---|---|
| `viajes` | un viaje por fila, los días en `jsonb` | gana el más reciente |
| `viaje_diario` | marcas, notas, posiciones, visitas, portadas | **por entrada**, con marca de tiempo propia |
| `viaje_fotos` | una foto por fila, en base64 | por id, con borrado lógico |

Lo del diario es lo más cuidado: si los dos anotáis cosas distintas sin cobertura,
al juntarse no se pierde nada. Para cada parada gana el gesto más reciente; si
uno marca y el otro desmarca después, queda desmarcada.

El SQL está en `/sql/`. Las políticas son abiertas para quien haya iniciado
sesión: son dos personas que comparten todo.

### Forma de un viaje

```js
{
  id: "v1a2b3c",
  nombre: "Croacia en círculo",
  desde: "2026-09-05",        // vacío = días numerados en vez de fechas
  hasta: "2026-09-12",
  salida: "San Miguel de las Dueñas",
  normas: ["Andando sin acera se camina por la izquierda", …],
  actualizado: "2026-07-26T18:00:00Z",
  dias: [{
    t: "Llegada a Zagreb",     // título de la jornada
    dest: "Zagreb",            // dónde se duerme: destino de navegación
    xy: "46.05,14.50",         // para el tiempo y el mapa del día
    km: "135 km · 2 h",
    lluvia: "Museo de …",      // plan B si llueve
    foto: "data:image/jpeg…",
    paradas: [{
      h: "Mañana",
      txt: "Lagos de Plitvice",
      c: "Plitvice",           // nombre corto para los botones
      n: "Entra por la puerta 2, reserva online",
      mapa: "Plitvicka Jezera ulaz 2",   // lo que se le pasa al navegador
      w: "Plitvicka jezera",   // nombre local, mejor para Waze
      xy: "44.88,15.61",       // para avisos de cercanía y el mapa
      g: "plitvice",           // id de su ficha en la guía
      key: true,               // imprescindible del día
      park: { n, w, p, gratis }
    }]
  }],
  reservas: {
    vuelos: [{ ruta, fecha, hora, cia, loc, n }],
    coche: { empresa, reserva, recogida, devolucion, telefono },
    telefonos: [{ q, n }]
  }
}
```

### El diario, aparte del viaje

```js
{
  hechas:      { "5:0": 1784… },              // parada marcada, con la hora
  desmarcadas: { "5:1": 1784… },
  notas:       { "5": { t:"…", ts:1784… } },
  posiciones:  { "5:0": { xy:"46.3,14.1", ts } },  // dónde estabas al marcar
  visitas:     [{ id, xy, ts, dia, txt, auto, manual, precision }],
  pernoctas:   [{ id, xy, ts, dia, txt, tipo, nota, valorada }],
  portadas:    { "5": { id:"eslovenia:5:178…", ts } }
}
```

---

## Reglas que no se saltan

**El caché puede dejarte la app vieja.** `sync.js` y `assets/app.js` van con
`?v=NN` en la URL y están excluidos del service worker. Si los tocas, **sube el
número** en las páginas que los cargan.

**La versión se ve en pantalla.** `const VERSION`. Súbela en cada publicación.

**Nada de claves de API en el repositorio.** Es público. La clave anónima de
Supabase sí puede estar: está pensada para ser pública y la protege el RLS.

**Los enlaces se verifican antes de publicarlos.** Ya pasó: se subieron 34
enlaces de Wikiloc con un formato que daba 404.

**Nunca `localStorage` sin `try/catch`.** En modo privado de iOS lanza excepción
y tumbaría la app entera.

**Nada de colores fijos en lo estructural.** Barra, cabecera, tarjetas y textos
usan variables, o el modo claro se rompe. Hay una prueba que lo vigila.

**Cada vista, sus propios identificadores.** Un día se dibuja dos veces —en Hoy y
en el detalle— y con ids repetidos las fotos acaban donde no toca. De ahí el
parámetro `ctx` con valores `hoy` y `det`.

---

## Servicios externos

Ninguno necesita clave. Todos son gratuitos para uso personal.

| Para qué | Cómo | Notas |
|---|---|---|
| Navegar | `waze://?q=` y `?ll=` | y `maps/search` para ver dónde está |
| Rutas a pie | `wikiloc://` y `map.do?q=` | el esquema ignora parámetros |
| Dormir en furgo | `p4n://` y `park4night.com` | solo en Asturias |
| Qué es un sitio | Wikipedia, `origin=*` | |
| Qué hacer allí | Wikivoyage, `origin=*` | |
| Qué hay cerca | Overpass (OpenStreetMap) | tres servidores, con reintentos |
| Tiempo por carretera | OSRM `table/v1/driving` | demo: máx. 1 petición/s |
| Cómo se llama este sitio | Nominatim `reverse` | máx. 1 petición/s |
| Buscar un sitio | Nominatim `search` | |
| El tiempo | Open-Meteo | sin clave, CC BY 4.0 |
| Free tours | Civitatis | enlace a la ciudad |
| Sincronizar | Supabase | clave anónima, pública |

Los esquemas `waze://`, `p4n://` y `wikiloc://` están **comprobados en un iPhone
real**. No están documentados por sus fabricantes: si dejan de funcionar, hay que
volver a probarlos a mano.

---

## Las pruebas

Dos herramientas, para dos cosas distintas.

**`node tests/probar.js`** comprueba que las apps funcionan. 68 comprobaciones, sin tocar la red ni GitHub:

1. Cada app carga sin errores y todas las pestañas pintan contenido
2. No hay enlaces con esquemas desconocidos
3. El editor guarda, importa Markdown y JSON, y exporta
4. Lo que exporta lo vuelve a leer igual
5. La sincronización aguanta sin sesión y sin conexión
6. La portada nunca se queda en «comprobando…», ni al cambiar de tema
7. No se usa ninguna función sin definir
8. Barra, cabecera y tarjetas siguen el tema claro
9. Cada vista tiene sus propios identificadores

**`node tests/foto.js`** comprueba que siguen haciendo *exactamente lo mismo*.
Guarda el HTML de las 34 vistas y lo compara después de mover código. Es lo que
hace seguro refactorizar:

```bash
node tests/foto.js guardar     # antes de tocar
node tests/foto.js comparar    # después
```

**Una prueba que nunca has visto fallar no sirve.** Después de escribirla,
reintroduce el fallo a propósito y comprueba que salta. Ha pasado dos veces que
una prueba diera verde con el error puesto.

---

## Lo que falta

Ver `PENDIENTE.md`. Y `AGENTS.md` si quien va a tocar esto es una IA.
Para usarla sin saber programar, `USO.md`.
