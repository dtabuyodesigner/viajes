# Lo que falta

Ordenado por lo que más cambia las cosas, no por lo que más cuesta.

---

## 1 · Unificar el motor  ·  fases 1 y 2 hechas

**Fase 1 (v72–v98).** `assets/app.js` es el motor compartido: ubicación, mapas,
búsquedas, cámara, documentos, pernoctas, alojamiento y el vistazo del día.

**Fase 2, hecha.** Eslovenia y Asturias ya no llevan sus datos dentro del HTML:
están en `eslovenia/datos.js` y `asturias/datos.js`. El HTML pone la estructura,
`assets/app.js` el motor y `datos.js` el viaje.

- Eslovenia: 2.279 → 1.912 líneas de HTML + 381 de datos.
- Asturias: 1.831 → 1.563 líneas de HTML + 281 de datos.
- La guía se unificó dentro del viaje (`viaje.guia`); antes Eslovenia la tenía
  suelta y Asturias dentro. El motor la indexa con `indexaGuia()`.
- Todos los bloques que no comparten los dos viajes son opcionales de verdad:
  `guia`, `info`, `vuelos`, `acceso`, `coche`, `seguros`, `telefonos`,
  `alojamientos`. Un viaje sin ellos abre igual.

**Un viaje nuevo ya es un archivo de datos, no una app entera.**

---

### Cómo estaba antes, para no olvidar por qué se hizo

**Lo que pasaba.** Había cuatro apps con el mismo código copiado: portada, visor,
Eslovenia y Asturias. Cada arreglo hay que hacerlo cuatro veces y cada repetición
es una ocasión de romper algo.

**Cuánto duele ya.** En una sola tarde esto provocó, como mínimo: la pestaña de
Reservas en blanco, la barra inferior oscura en modo claro, textos invisibles al
sol, `navegarXY` usada sin definir, las fotos colándose en todos los días, y el
botón de situarme roto en el visor. Todos por lo mismo: tocar lo mismo en varios
sitios y que uno se quede atrás.

**Qué habría que hacer.** Sacar el motor a `assets/app.js` y que cada viaje sea
solo su archivo de datos. El service worker lo guarda una vez y sirve para todos,
así que el funcionamiento sin cobertura no se pierde.

**Cuidado con:** las apps a medida tienen bloques propios —Eslovenia tiene
vuelos, seguros y guía de 39 fichas; Asturias tiene park4night—. El motor debe
permitirlos sin obligar a que todos los viajes los tengan.

**Cuándo.** Ahora. Es lo que más riesgo quita y lo único que impide seguir
añadiendo con tranquilidad.

---

## 2 · Que Eslovenia y Asturias se puedan editar  ·  hecho

Pestaña Información → **Editar este viaje**. El viaje pasa a los viajes del móvil
con su id de siempre (`eslovenia`, `asturias`, obligatorio: `viaje_diario` y
`viaje_fotos` ya tienen filas con esas claves) y se abre en el editor.

`viajeEnUso()` decide cuál manda: la copia guardada si la hay, si no la del
archivo. Y solo la acepta si tiene días, para que un guardado a medias no deje
la app sin itinerario en carretera. **Volver al viaje original** deshace.

La guía y las reservas se conservan aunque el editor todavía no las enseñe: hay
una prueba que compara campo por campo tras abrir y guardar sin tocar nada.

**Lo que falta de esto**, sin prisa:

- El editor no tiene formularios para guía, vuelos, coche, seguros, teléfonos ni
  alojamientos. Se conservan, pero para cambiarlos hay que tocar `datos.js`.
- La fecha de salida de Asturias sigue en `PREF.salida`, en el `localStorage` de
  cada móvil, en vez de en `viaje.desde`. Moverla la haría sincronizable, pero
  **es un cambio de comportamiento**, no un refactor: hoy cada teléfono puede
  tener la suya. Decidirlo antes de tocarlo.
- `vistaInfo()` sigue escrita a mano en cada app, con sus claves (`conducir`,
  `perras`, `furgo`…). Convertir `info` en una lista de secciones recorrible la
  dejaría en un solo bucle. No corre prisa: es presentación de cada app, no del
  motor, y Asturias intercala park4night entre bloques.

---

## 3 · Mapas sin cobertura

**Por qué no está hecho, con honestidad.** Es lo más difícil de la lista: las
teselas pesan decenas de megas, iOS borra el almacenamiento de las webs que no se
usan en unas semanas, y OpenStreetMap prohíbe la descarga masiva en sus
condiciones de uso.

**Alternativa realista.** Que el usuario se descargue la zona en **Organic Maps**
y enlazar desde la app. Menos vistoso, funciona seguro.

---

## 4 · Enchufar Organic Maps

App de mapas offline con datos de OpenStreetMap: trae caminos de montaña,
fuentes y refugios que Google no tiene.

**Qué falta.** Comprobar en un iPhone si responde a `om://`. Si abre, añadir un
botón por parada. Si no, dejar el aviso de «descárgate la zona antes de salir».

---

## 5 · Que la app llame sola a la IA

Hoy el editor prepara la petición, la pegas en Claude o ChatGPT y traes la
respuesta a Importar. Funciona y no cuesta nada, pero son tres pasos manuales.

**Qué habría que hacer.** Una función en Supabase que guarde la clave y haga de
intermediaria.

**Coste real.** Con Sonnet, unos 3–5 céntimos por viaje generado.

**Cuidado con:** poner límite de gasto mensual en la consola antes de nada, y un
tope de peticiones por usuario en la propia función.

---

## 6 · Compartir con gente de fuera

Las políticas de Supabase dan acceso a todo a **cualquiera que inicie sesión** en
el proyecto. Mientras lo usen dos personas no hay problema, pero si se comparte
de verdad hay que cerrarlo: que cada cuenta vea solo lo suyo, o marcar qué viajes
son compartidos.

Es media hora de SQL. **Hacerlo antes de dar el enlace a nadie más.**

---

## 2b · Lo que hay que comprobar en un iPhone

**Esto es lo único del hito que no se puede dar por bueno sin probarlo.**

Editar Eslovenia o Asturias pasa el viaje al editor por el almacén del móvil.
En iOS, una app añadida a la pantalla de inicio tiene su propio almacén,
separado del de Safari: WebKit lo confirma como intencional en el bug 181849, y
**ningún** almacén del navegador escapa a esa partición (ni IndexedDB, ni Cache,
ni `sessionStorage`).

Lo que no se ha podido verificar con ninguna fuente: si `location.href` hacia
otra carpeta, **desde una app instalada sin manifest**, se queda dentro del
contenedor o sale a Safari. De eso depende todo, y solo se sabe probando.

Por eso el traspaso **no lo supone**: lleva acuse de recibo. Si el editor no
recibe el viaje, lo dice y ofrece copiar y pegar, en vez de abrir un viaje en
blanco haciéndolo pasar por el bueno.

**Cómo comprobarlo, Dani:**

1. Borra el icono de Eslovenia de la pantalla de inicio, si lo tienes.
2. Abre la web en Safari y añádela otra vez a la pantalla de inicio.
3. Cierra Safari del todo, desde el selector de apps.
4. Abre el icono de Eslovenia, ve a Información y pulsa «Abrir en el editor».
5. Mira si aparece la barra de Safari arriba, y si el editor enseña el viaje o
   dice «No he podido traer el viaje».
6. Cuéntalo. Según lo que salga:
   - **Enseña el viaje** → el camino funciona desde el icono, no hay nada que hacer.
   - **Dice que no lo ha recibido** → funciona desde Safari pero no desde el
     icono. Hay que decidir si se añade un manifest con `scope` (ver abajo) o si
     se deja el copiar y pegar como única vía desde el icono.

**Relacionado:** `index.html` enlaza `<link rel="manifest" href="manifest.json">`
y **ese archivo no existe**. Ninguna de las cinco apps tiene manifest de verdad;
todas van con el `<meta apple-mobile-web-app-capable>` de siempre. Un manifest
con `scope` podría hacer que la navegación se quede dentro de la app instalada,
pero cambia cómo se instalan y no se puede probar sin un iPhone. **Decidirlo
después del punto anterior, no antes.**

---

## 2c · Fiabilidad · A1, A2, A3 y A5 hechos; queda A4

**A1, hecho en `feature/fiabilidad-usabilidad-diseno`:** esperas finitas, doble
pulsación y recuperación de botones.

- `conTope()` en todas las llamadas a Supabase. Había ocho sin tope, incluidas
  las de fotos. Una prueba vigila que no vuelva a colarse ninguna.
- `fetchConTope()`: aborta de verdad y dice el motivo en castellano.
- `trabajando()`: desactiva el botón, lo anuncia con `aria-busy` y lo devuelve a
  su texto también al fallar. **Antes `.disabled` no aparecía ni una sola vez en
  los siete archivos.**
- «Buscar actualización» ya no puede colgarse. Era el peor caso: el botón de
  auto-rescate quedándose él mismo en «Limpiando…».

**Lo que queda del bloque de fiabilidad:**

- **A2 · Centro de estado común. HECHO.** `comoEstaTodo()` y
  `resumenDeEstado()` en `sync.js`, que lo cargan las cinco. La portada enseña el
  detalle completo; el editor y los tres viajes, una línea que se abre. Con
  `aria-live`, glifo además del color, y `--ok-txt`/`--aviso-txt` por tema porque
  el verde de «todo bien» tenía **1,87 de contraste** sobre fondo claro: era el
  estado que más se mira y el que peor se leía al sol.

  **Lo que se decidió NO decir, y por qué:**
  - *Hora de la última sincronización*: no existe ninguna confirmada por el
    servidor. `actualizado` la pone siempre el propio móvil antes de mandar. Para
    tenerla haría falta leer de vuelta una columna generada en Postgres, y eso es
    cambio de esquema.
  - *Si el diario está subido*: cada gesto hace `subir().catch(()=>{})` y un
    fallo no deja rastro. **No hay cola de pendientes para el diario**, a
    diferencia de viajes y fotos.

    La primera versión de A2 decía «A salvo · lo ve el otro móvil» cuando la nube
    respondía y las colas conocidas estaban vacías. **Eso era una garantía
    universal que incluía el diario**, del que no se sabe nada: una nota podía no
    haber llegado y la pantalla afirmar que estaba todo bien. Corregido en la
    revisión del PR #3: el resumen verde dice «Viajes y fotos al día», el diario
    tiene su propia fila, y una prueba recorre el texto visible de las cinco apps
    buscando frases que prometan de más.

    Darle cola al diario sigue siendo trabajo aparte —cambia persistencia y
    sincronización— y es lo que haría falta para poder decir algo sobre él.
  - *Qué fotos concretas están guardadas para usar sin cobertura*: se comprueba
    que exista la caché de cada app y que dentro esté su página. Ir más allá
    exigiría derivar de `datos.js` la lista de todo lo que cada viaje usa y
    comprobarla una a una. Se documenta la limitación en vez de prometer de más.

  **El cierre de sesión, resuelto y con una corrección:** la nota anterior decía
  que el botón seguía esperando a `pintaNube()`. Era una lectura equivocada: esa
  llamada no llevaba `await`, así que el botón ya se soltaba a los ≤8 s. Lo que
  sí se ha hecho es quitar la sincronización completa que disparaba al salir —
  ahora repinta con lo que ya se sabe, sin volver a hablar con la nube.

- **A5 · Entrar y salir. HECHO.** «Entrar» no estaba envuelto en `trabajando()`:
  no se desactivaba y admitía doble pulsación durante hasta ~32 s en el peor caso
  encadenado. Ahora los dos van envueltos, con pruebas de servidor colgado y
  doble pulsación.

- **A3 · La espera de las búsquedas. HECHO.** Había **cuatro** implementaciones,
  no tres: el visor tiene la suya, con un solo servidor y hasta 58 s en un único
  intento. Peor caso de punta a punta, contando GPS y tiempos por carretera:
  entre 70 y 100 s según el flujo.

  Ahora hay **un plazo desde el toque** —30 s— que cubre GPS y servidores de
  mapas hasta los primeros resultados. Cambiar de servidor no reinicia el reloj,
  y tampoco lo reinicia caer de «de camino hoy» a «cerca de aquí». Los tiempos
  por carretera van después y aparte, con su propio límite corto.

  Se puede **cancelar**, y la cancelación cubre la operación entera: aborta las
  peticiones en vuelo, deja de esperar al GPS en el acto y descarta su respuesta
  si llega tarde. Cancelar no se presenta como fallo.

  Además del `AbortController` hay una **generación** de búsqueda. Hace falta
  porque el GPS no admite aborto y porque una respuesta vieja puede llegar
  cuando ya se pidió otra categoría: sin ella, una búsqueda vieja podía pisar
  los resultados de la nueva. Ese fallo existía y no lo veía nadie.

  **El visor entra en la misma política** con el mismo motor, pero mantiene su
  servidor único: darle los otros dos cambiaría proveedores y eso queda fuera de
  este bloque. Es una mejora fácil y pendiente.

  **Y se arregló un fallo que dejaba muerta una pestaña entera**: `modoBusca` se
  usaba ocho veces en el visor y no se declaraba en ninguna. Al pulsar «Usar mi
  ubicación» saltaba un `ReferenceError` que el `try/catch` se tragaba, así que
  los chips de categoría no llegaban a aparecer y «Qué hay cerca» no funcionaba.
  Venía de antes de este bloque.

  **Lo que queda pendiente de aquí:**
  - Darle al visor los tres servidores de Overpass, como las apps a medida.
  - En el visor, «De camino hoy» cambia la etiqueta pero busca igual que «Cerca
    de aquí»: no usa `buscarEnRuta`. O se implementa o se quita el botón.
  - `lanzarServicios` sigue duplicado casi letra por letra entre Eslovenia y
    Asturias. El motor común ya se llevó lo que importaba; el orquestador no.

- **A4 · Doble pulsación en cámara y documentos.** `activaCamara` y
  `enganchaDoc` admiten dos selecciones seguidas. Menos grave que las demás
  porque exige dos interacciones deliberadas con el selector de archivos.
---

## 6b · Cosas pequeñas encontradas y no arregladas

Ninguna bloquea. Anotadas para no volver a descubrirlas:

- **El diario no tiene cola de pendientes.** Viajes y fotos sí. Si una nota no
  sube, no queda rastro y nadie se entera. Es la pieza que falta para que el
  centro de estado pueda hablar del diario con honestidad.
- **Ids sin parte aleatoria.** `nuevoId()` del editor y los ids de `visitas` y
  `pernoctas` en `sync.js` son `Date.now().toString(36)` a secas. Los de fotos y
  documentos sí llevan azar, precisamente porque ya hubo colisiones. Dos viajes
  creados en el mismo milisegundo colisionarían. Riesgo bajo hoy.
- **El visor duplica la lectura de `viajes_propios`** en vez de usar
  `SYNC.locales()`.
- **El visor tiene `VIAJE_ID` e `ID`** para lo mismo, con distinto respaldo.
- **`distancia()` redondeaba a entero en Eslovenia y Asturias y no en el visor.**
  Mismo nombre, mismo algoritmo, resultado distinto. Sigue así: unificarlo
  cambiaría las distancias que ve una de las dos familias, y hay que decidir cuál
  gana antes de tocarlo.
- **El gradiente `id="g"` se repite en cada ilustración.** `CIELO` lo define y
  todas las ilustraciones lo llevan, así que en la pestaña Guía aparece muchas
  veces. `url(#g)` resuelve al primero, y como todos son idénticos no cambia
  nada: es marcado inválido, no un fallo. Arreglarlo mueve las fotografías sin
  que nadie note la diferencia, así que se deja para el hito visual. La prueba
  de ids repetidos deja fuera lo que va dentro de un `<svg>` por eso.
- **Áreas táctiles por debajo de 44 px** en toda la app: `.tick` 22×22,
  `.quitar` 23, `.estrella` 24, y el `.btn` normal ~34 de alto. Ningún botón
  declara `min-height`. → hito visual.
- **28 tamaños de letra y 15 radios de borde distintos** entre las cinco apps,
  y cada una nombra los mismos roles de color de forma distinta. → hito visual.
- **El acuse del traspaso (`traspaso_ok`) es por móvil, no por app.** Si un móvil
  usa a la vez Safari y el icono de inicio, el acuse que deja Safari no dice nada
  sobre lo que pasa desde el icono. Es conservador en la dirección buena (como
  mucho, avisa de un fallo que en Safari no ocurre), pero conviene saberlo.
- **Los cambios de un viaje editado llegan al abrir la portada**, que es donde se
  llama a `SYNC.sincronizar()`. Las apps de viaje solo sincronizan el diario.

---

## 7 · Datos que faltan

- **Asturias:** las fechas de agosto y los sitios de park4night de cada noche.
- **Eslovenia:** teléfonos de los alojamientos.

Sin fechas, Asturias funciona con días numerados. En cuanto se pongan, la app
arranca sola en el día que toca.

---

## Lo que costó más de lo que parecía

Estas cuatro cosas parecían de cinco minutos y llevaron horas. Anotadas para que
no vuelvan a sorprender:

**Que una versión nueva llegue al móvil.** Tres fallos encadenados: el service
worker no conocía `assets/app.js`, el `?v=` hacía que la copia guardada no
coincidiera nunca, y `getRegistrations()` solo limpiaba una carpeta. Resuelto en
v79, v83 y v89.

**«De camino hoy».** Cuatro intentos: la consulta era demasiado pesada, luego la
posición estaba en otro formato, luego buscaba en todo el día en vez de por
delante, y al final la posición estaba caducada. v80 a v87.

**Dar mensajes útiles.** Mientras el error decía «no se pudo consultar», cada
diagnóstico eran varios intentos a ciegas. En cuanto mostró `x.split is not a
function`, se arregló en minutos.

**Un borrado de datos que nadie veía.** `subir()` no mandaba `reservas` ni
`normas`, y `_sincronizar()` sustituía el viaje local por el de la nube en vez de
fundirlos. Bastaba un móvil: al guardar quedaba `actualizado` = T0 en local y T1
en la nube, así que en la siguiente sincronización la nube ganaba siempre y se
llevaba por delante vuelos, localizadores, coche, teléfonos y normas. Llevaba
tiempo publicado y ninguna prueba lo miraba, porque todas comprobaban que las
apps pintaran, no que los datos sobrevivieran a un viaje de ida y vuelta.

**Los formatos que cada app usa por su cuenta.** Al unificar aparecieron tres:
`MIPOS` como lista y `miPos` como texto, `distancia` y `distKm`, `pedirUbicacion`
y `ubicacion`. Ninguno daba error de sintaxis; todos fallaban al usarlos.

---

## Ideas sin decidir


- **Preparativos antes de salir**, con cuenta atrás: antiparasitario, revisión de
  la furgo, viñeta, mapas descargados, taxi de madrugada.
- **Modo conducción:** letra grande, solo la siguiente parada, un botón.
- **El diario de vuelta:** convertir marcas, notas y fotos en un recuerdo
  compartible cuando acabe el viaje.
- **Presupuesto por viaje**, tirando de la app de gastos que ya existe.
- **Copiar un día a otro viaje.**
- **Foto del alojamiento** como slot propio, distinta de las del día.

---

## Ya está hecho

Para no volver a proponerlo:

| Qué | Versión |
|---|---|
| Editor de viajes propios | v34 |
| Sincronización de viajes con Supabase | v35 |
| Pedir el viaje a una IA e importar su respuesta | v44–v48 |
| Reservas con localizadores y teléfonos | v48 |
| Rama `dev`, pruebas automáticas y documentación | v49 |
| Modo claro, automático y oscuro en las cinco apps | v50–v55 |
| Aviso al estar cerca de una parada | v53 |
| Servicios de OpenStreetMap en las tres apps | v53–v58 |
| Tiempo real en coche por carretera | v56 |
| El tiempo dentro de la app | v57 |
| Cámara y fotos por día | v59 |
| Fotos compartidas entre móviles | v60 |
| «Estoy aquí» y recorrido real | v62 |
| Foto de portada del día | v62 |
| Nombre automático del sitio por GPS | v64 |
| Normas de circulación del país | v64 |
| Compartir la app | v64 |
| Añadir sitios por los que ya se pasó | v68 |
| Mapa en cada día | v69–v72 |
| Motor común, fase 1 | v72 · `dev` |
| Motor común, fase 2: los datos de cada viaje, aparte | esta rama |
| Eslovenia y Asturias, editables desde el móvil | esta rama |
| La nube deja de borrar reservas, normas y guía al sincronizar | esta rama |
| Prueba de que lo que carga una app está en su service worker | esta rama |
| El primer vistazo: lo que importa del día, al abrir | v73 |
| El vistazo recuerda tus notas de ayer y de días pasados | v73 |
| Servicios ordenados por tiempo real | v74 |
| Búsquedas en radios grandes sin atragantar al servidor | v75 |
| Dónde dormimos: guardar, clasificar y valorar la pernocta | v76 |
| Servicios: tres servidores y reintentos, hasta 20 resultados | v77 |
| El service worker guarda el motor común | v79 |
| Buscar «de camino hoy» además de «cerca de aquí» | v80 |
| Localizar de nuevo antes de cada búsqueda | v87 |
| «Qué ver por aquí»: monumentos, museos y miradores alrededor | v90 |
| Alojamiento con nombre, web propia y ficha de Google | v91, v95, v96 |
| El mapa se sitúa al momento sin esperar al GPS | v91 |
| Datos de las tarjetas de embarque en Reservas | v92 |
| Guardar las tarjetas de embarque en el móvil, varias por vuelo | v93, v94 |
| Los puntos de «por dónde hemos pasado», tocables | v96 |
| Alojamiento con web propia, Booking y búsqueda | v91 |
| Guardar las tarjetas de embarque en el móvil | v93 |
| El mapa se sitúa al momento, sin esperar al GPS | v91 |

---

## Cosas que se probaron y no funcionan

| Idea | Por qué |
|---|---|
| Coordenadas en la URL de Wikiloc | Las ignora y abre el mapa del mundo |
| `wikiloc://map?q=` y variantes | El esquema ignora toda ruta |
| Compartir sesión entre apps del inicio | En iOS cada una tiene su almacén |
| `waze.com/ul?q=` desde una app instalada | Falla al saltar; hay que usar `waze://` |
| Bajar imágenes de bancos libres desde el asistente | La red del entorno no llega |
| Fotos de hoteles desde Booking | Son suyas: copiarlas sería infracción |

---

## Cómo unificar el motor, paso a paso

Es el punto 1 de esta lista y el que más riesgo quita. Así se hace sin romper
nada.

### La red de seguridad

```bash
node tests/foto.js guardar     # fotografía cómo se comporta ahora
# …mover código…
node tests/foto.js comparar    # ¿sale exactamente lo mismo?
```

`tests/foto.js` abre cada app, recorre todas las pestañas y todos los días, y
guarda el HTML que producen. Si después de mover código el HTML es idéntico, el
refactor no ha cambiado nada visible. Ignora comentarios y números de versión,
así que solo salta cuando cambia el comportamiento de verdad.

**Regla:** si `comparar` sale en verde, sigue. Si sale en rojo y no era lo que
querías, deshaz y mira qué se rompió: te dice la vista y el carácter exacto.

### Fase 1 · Lo que ya es idéntico

Todo esto está copiado **letra por letra** en tres o cuatro archivos. Moverlo es
mecánico y no cambia nada:

| Bloque | Dónde está hoy |
|---|---|
| `TEMA` (modo de color) | las cinco apps |
| Cámara, galería, portada del día | Eslovenia, Asturias, visor |
| «Estoy aquí», buscar y añadir sitios | Eslovenia, Asturias, visor |
| Mapa del día y mapa de cabecera | Eslovenia, Asturias, visor |
| `porCarretera`, `formatoTiempo` | Eslovenia, Asturias, visor |
| `elTiempo`, `pintaTiempo`, `TIEMPOS` | Eslovenia, Asturias, visor |
| Servicios de OpenStreetMap | Eslovenia, Asturias, visor |
| `esc`, `waze`, `mapa`, `navegar`… | las cinco |

Van a `assets/app.js`, que ya carga `sync.js` y por tanto se guarda igual sin
cobertura. **Mueve un bloque, compara, sigue.** Uno cada vez, nunca dos.

Solo con esta fase desaparece la mayor parte del dolor: son los bloques que se
han tocado más veces hoy y donde han salido casi todos los fallos.

### Fase 2 · Separar los datos

Cada viaje pasa a ser `eslovenia/datos.js` con su `VIAJE`, su `GUIA` y su `info`.
El HTML queda reducido a la estructura y a cargar el motor y los datos.

A partir de aquí, un viaje nuevo es un archivo de datos, no una app entera.

### Fase 3 · Lo que no es igual

Eslovenia tiene vuelos, seguros y una guía de 39 fichas. Asturias tiene
park4night. El visor tiene el editor detrás. Eso **no** se fuerza a ser común: el
motor debe permitir bloques propios sin obligar a nadie a tenerlos.

La señal de que te estás pasando: si para unificar tienes que meter un `if` con
el nombre del viaje dentro del motor, ese trozo no era común.

### Qué no hacer

- **No refactorizar y añadir a la vez.** Una cosa o la otra.
- **No hacerlo con alguien usando la app en carretera.** Trabaja en `dev` y
  mezcla a `main` cuando `probar` y `comparar` estén los dos en verde.
- **No mover cinco bloques y luego comparar.** Uno cada vez.
