# Viajes

Apps de viaje que funcionan **sin cobertura**, para usar en el móvil mientras se
conduce por sitios donde no hay línea.

**https://dtabuyodesigner.github.io/viajes/**

---

## Qué hay

```
/                     portada: elige viaje, sincroniza, actualiza
/eslovenia/           Eslovenia y Venecia, 18–29 julio 2026   (a medida)
/asturias/            Asturias occidental, 5 días             (a medida)
/crear/               editor: crear y editar viajes propios
/viaje/?id=xxx        visor de los viajes creados
/sync.js              sincronización con Supabase (compartido por todas)
/img/  /fotos/        dibujos, mapas y fotos
/sql/                 SQL de las tablas, para pegar en Supabase
/tests/probar.js      59 comprobaciones automáticas
```

Cada carpeta es una app independiente de **un solo archivo HTML** con su CSS y su
JavaScript dentro. Sin compilar, sin dependencias, sin `node_modules` en
producción. Se abre el archivo y funciona.

---

## Los tres principios

**1. Manda el móvil, la nube es un espejo.**
Todo se guarda primero en `localStorage`. La app va igual sin cobertura y sin
sesión. Supabase iguala cuando hay red. Si la nube falla, no se entera nadie.

**2. Ninguna espera es infinita.**
Toda llamada de red lleva tope de tiempo (`conTope()` en `sync.js`). Si algo no
responde, se avisa. Nunca se deja un botón en «Cargando…» para siempre.

**3. Se prueba antes de publicar.**
`node tests/probar.js` antes de cada subida. Sin excepciones.

---

## Empezar

```bash
npm install            # solo jsdom, para las pruebas
node tests/probar.js   # deben salir las 59 comprobaciones en verde
```

Los cambios van a `dev`. A `main` solo lo probado: `main` es lo publicado y puede
estar usándose en carretera ahora mismo.

---

## Qué sabe hacer cada app

|  | Portada | Eslovenia | Asturias | Visor | Editor |
|---|:--:|:--:|:--:|:--:|:--:|
| Día a día con paradas | | ● | ● | ● | |
| Navegación Waze + Maps | | ● | ● | ● | |
| Marcar paradas y notas | | ● | ● | ● | |
| Guía de lugares | | 37 fichas | 27 fichas | | |
| Reservas y localizadores | | ● | | ● | ● |
| Mapa de la ruta | | ● | ● | | |
| Qué tengo cerca | | ● | ● | ● | |
| Servicios (OpenStreetMap) | | ● | ● | ● | |
| El tiempo | | ● | ● | ● | |
| Aviso de cercanía | | ● | ● | ● | |
| park4night | | | ● | | |
| Crear e importar viajes | | | | | ● |
| Sincronización | ● | ● | ● | ● | ● |
| Modo claro / oscuro | ● | ● | ● | ● | ● |

---

## Cómo se guardan los datos

### En el móvil (`localStorage`)

| Clave | Qué guarda |
|---|---|
| `viajes_propios` | los viajes creados, como lista de objetos |
| `viajes_pendientes` | ids que faltan por subir a la nube |
| `diario_<viaje>` | paradas marcadas y notas de ese viaje |
| `tema_viajes` | `auto`, `claro` u `oscuro`, compartido por todas |
| `nav_app`, `nav_via`, `nav_avisar` | preferencias de Eslovenia |
| `ast_app`, `ast_via`, `ast_avisar` | preferencias de Asturias |
| `gen_app`, `gen_avisar` | preferencias del visor |
| `sb-…-auth-token` | sesión de Supabase (la pone la librería) |

**Ojo con iOS:** cada app añadida a la pantalla de inicio tiene **su propio
almacén**, aunque el dominio sea el mismo. Por eso hay que iniciar sesión en cada
una por separado.

### En Supabase (proyecto `cmkzcvfjgrgxwqjimtxa`)

**`viajes`** — un viaje por fila, los días en `jsonb`, con `actualizado` para
resolver conflictos: gana el más reciente.

**`viaje_diario`** — marcas y notas. Cada entrada lleva **su propia marca de
tiempo**, así que si los dos anotáis sin cobertura, al juntarse no se pierde
nada: para cada parada gana el gesto más reciente.

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
  actualizado: "2026-07-26T06:00:00Z",
  dias: [{
    t: "Llegada a Zagreb",     // título de la jornada
    dest: "Zagreb",            // dónde se duerme: destino de navegación
    xy: "46.05,14.50",         // opcional: para el tiempo y el mapa
    km: "135 km · 2 h",        // opcional
    lluvia: "Museo de …",      // plan B, opcional
    foto: "data:image/jpeg…",  // opcional, comprimida a ~900 px
    paradas: [{
      h: "Mañana",             // opcional
      txt: "Lagos de Plitvice",
      c: "Plitvice",           // nombre corto para los botones
      n: "Entra por la puerta 2, reserva online",
      mapa: "Plitvicka Jezera ulaz 2",   // lo que se le pasa al navegador
      w: "Plitvicka jezera",   // opcional: nombre local, mejor para Waze
      xy: "44.88,15.61",       // opcional: para avisos de cercanía
      g: "plitvice",           // opcional: id de su ficha en la guía
      key: true,               // imprescindible del día
      park: { n:"…", w:"…", p:"…", gratis:true }   // aparcamiento
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

**El caché puede dejarte la app vieja.** `sync.js` va con `?v=NN` en la URL y
está excluido del service worker. Si tocas `sync.js`, **sube el número** en las
páginas que lo cargan, o la gente seguirá con la versión antigua.

**La versión se ve en pantalla.** `const VERSION` en la portada y en las apps a
medida. Súbela en cada publicación: es lo que permite saber si el móvil tiene lo
último.

**Nada de claves de API en el repositorio.** Es público. La clave anónima de
Supabase sí puede estar: está pensada para ser pública y la protege el RLS.

**Los enlaces se verifican antes de publicarlos.** Ya pasó: se subieron 34
enlaces de Wikiloc con un formato que daba 404.

**Nunca `localStorage` sin `try/catch`.** En modo privado de iOS lanza excepción
y tumbaría la app entera.

**Nada de colores fijos en lo estructural.** Barra, cabecera y tarjetas usan
variables, o el modo claro se rompe. Hay una prueba que lo vigila.

---

## Servicios externos

Ninguno necesita clave. Todos son gratuitos para uso personal.

| Para qué | Cómo | Notas |
|---|---|---|
| Navegar | `waze://?q=` y `?ll=` | Google Maps de respaldo en cada botón |
| Rutas a pie | `wikiloc://` y `map.do?q=` | el esquema ignora parámetros: abre en tu ubicación |
| Dormir en furgo | `p4n://` y `park4night.com` | solo en Asturias |
| Qué es un sitio | Wikipedia, `origin=*` | |
| Qué hacer allí | Wikivoyage, `origin=*` | |
| Qué hay cerca | Overpass (OpenStreetMap) | una petición por consulta |
| Tiempo real por carretera | OSRM `table/v1/driving` | servidor de demostración: máx. 1 petición/s |
| El tiempo | Open-Meteo | sin clave, CC BY 4.0 |
| Free tours | Civitatis | enlace a la ciudad |
| Sincronizar | Supabase | clave anónima, pública |

Los esquemas `waze://`, `p4n://` y `wikiloc://` están **comprobados en un iPhone
real**. No están documentados por sus fabricantes: si dejan de funcionar, hay que
volver a probarlos a mano.

---

## Las pruebas

`node tests/probar.js` — 59 comprobaciones, sin tocar la red ni GitHub:

1. Cada app carga sin errores y todas las pestañas pintan contenido
2. No hay enlaces con esquemas desconocidos
3. El editor guarda, importa Markdown y JSON, y exporta
4. Lo que exporta lo vuelve a leer igual
5. La sincronización aguanta sin sesión y sin conexión
6. La portada nunca se queda en «comprobando…», ni al cambiar de tema
7. No se usa ninguna función sin definir
8. Barra, cabecera y tarjetas siguen el tema claro

**Una prueba que nunca has visto fallar no sirve.** Después de escribirla,
reintroduce el fallo a propósito y comprueba que salta.

---

## Lo que falta

Ver `PENDIENTE.md`. Y `AGENTS.md` si quien va a tocar esto es una IA.
