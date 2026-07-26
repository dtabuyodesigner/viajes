# Lo que falta

Ordenado por lo que más cambia las cosas, no por lo que más cuesta.

---

## 1 · Unificar el motor

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

- **Lista de lo que hay que reservar.** La app ya lo sabe: está escrito en las
  notas («reserva online, en verano se agotan») pero enterrado en el día 6.
  Sacarlo a una lista es casi gratis.
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
