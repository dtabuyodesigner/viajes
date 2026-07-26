# Lo que falta

Ordenado por lo que más cambia las cosas, no por lo que más cuesta.

---

## 1 · Unificar el motor  ·  fase 1 hecha, en `dev`

**Hecho ya (v72, rama `dev`).** `assets/app.js` con la cámara y las fotos,
«Estoy aquí» y buscar sitios, el mapa del día, el mapa de cabecera, el tiempo de
Open-Meteo y los tiempos por carretera de OSRM. **758 líneas fuera de la
triplicación**, de 784 duplicadas quedan 96. Las 34 fotografías salen idénticas.

Aparecieron dos cosas al mover: el visor tenía el hueco del tiempo sin rellenar
—lo ha ganado gratis— y su función de ubicación se llamaba distinto.

**Falta la fase 2** (separar los datos de cada viaje) y las 96 líneas de bloques
pequeños que difieren lo justo para no poder moverlos tal cual: dictado por voz,
compartir el diario y las rutas de Wikiloc.

**Mezclado a `main` en v73**, a petición.

---

### Lo que había antes

**Qué pasa hoy.** Hay cuatro apps con el mismo código copiado: portada, visor,
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

## 2 · Que Eslovenia y Asturias se puedan editar

Hoy son archivos escritos a mano: cambiar una parada requiere tocar código y
publicar. Convertirlas al formato de los viajes creados las haría editables desde
el móvil y sincronizables como las demás.

**Depende del punto 1.** Es la misma faena.

**Cuidado con:** no perder las guías. Son contenido escrito, no plantilla.

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

## 7 · Datos que faltan

- **Asturias:** las fechas de agosto y los sitios de park4night de cada noche.
- **Eslovenia:** teléfonos de los alojamientos.

Sin fechas, Asturias funciona con días numerados. En cuanto se pongan, la app
arranca sola en el día que toca.

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
| El primer vistazo: lo que importa del día, al abrir | v73 |
| El vistazo recuerda tus notas de ayer y de días pasados | v73 |

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
