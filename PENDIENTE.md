# Lo que falta

Ordenado por lo que más cambia las cosas, no por lo que más cuesta.

---

## 1 · Unificar el motor

**Qué pasa hoy.** Hay cuatro apps con el mismo código copiado: la portada, el
visor, Eslovenia y Asturias. Cada arreglo hay que hacerlo cuatro veces y cada
repetición es una ocasión de romper algo. Ya pasó: al reescribir los teléfonos
de Eslovenia se borró el bloque de alojamientos y la pestaña Reservas se quedó
en blanco con el usuario en carretera.

**Qué habría que hacer.** Sacar el motor a `assets/app.js` y que cada viaje sea
solo su archivo de datos. El service worker lo guarda una vez y sirve para todos,
así que el funcionamiento sin cobertura no se pierde.

**Por qué no se ha hecho.** Es un cambio grande y hasta ahora la forma de las
apps seguía moviéndose. Refactorizar mientras se añaden funciones multiplica el
riesgo. Ahora que la forma está estable, toca.

**Cuidado con:** las apps a medida tienen cosas que el motor genérico no —
Eslovenia tiene vuelos, seguros y pólizas; Asturias tiene park4night. El motor
debe permitir bloques propios sin obligar a que todos los viajes los tengan.

---

## 2 · Que Eslovenia y Asturias se puedan editar

**Qué pasa hoy.** Son archivos escritos a mano. Cambiar una parada de Asturias
requiere tocar el código y publicar. El usuario no puede.

**Qué habría que hacer.** Convertir sus datos al formato de los viajes creados y
que los abra el visor genérico. Los dos viajes quedarían editables desde el
móvil y se sincronizarían como los demás.

**Depende de:** el punto 1. Es la misma faena, en realidad.

**Cuidado con:** no perder lo que las hace buenas. La guía de 27 fichas de
Asturias y las 36 de Eslovenia son contenido escrito, no plantilla. Si el
formato genérico no admite fichas de guía, hay que añadírselo antes.

---

## 3 · Mapas sin cobertura

**Qué pasa hoy.** El itinerario funciona sin red, pero el mapa no. En Somiedo
tienes las paradas y no puedes ver dónde caen.

**Qué habría que hacer.** Descargar las teselas de la zona del viaje antes de
salir y guardarlas para usarlas luego.

**Por qué no está hecho, con honestidad.** Es la más difícil de la lista:

- Las teselas pesan. Una zona como Somiedo con detalle suficiente son decenas de
  megas. `localStorage` tiene unos 5 MB: **no cabe**. Habría que usar IndexedDB
  o la Cache API.
- iOS borra el almacenamiento de las webs que no se usan en unas semanas. Puede
  que descargues los mapas en julio y en agosto ya no estén.
- Los servidores de teselas de OpenStreetMap **prohíben la descarga masiva** en
  sus condiciones de uso. Habría que usar un proveedor que lo permita, y los que
  lo permiten suelen cobrar.

**Alternativa realista.** En vez de pelearse con esto, avisar al usuario de que
se descargue la zona en Organic Maps o en Google Maps, que ya lo hacen bien, y
enlazar desde la app. Menos vistoso, funciona seguro.

---

## 4 · Aviso al llegar cerca de algo

**Qué habría que hacer.** La app sabe dónde estás y dónde están las paradas.
Podría decir «estás a 2 km del mirador de Ojstrica» sin que preguntes.

**Cuidado con:** la batería. Vigilar la posición en segundo plano la vacía.
Mejor comprobar solo cuando la app está abierta, o cuando se abre la pestaña de
hoy. Y que se pueda apagar.

---

## 5 · Que la app llame sola a la IA

**Qué pasa hoy.** El editor prepara la petición, tú la pegas en Claude o
ChatGPT, copias la respuesta y la importas. Funciona y no cuesta nada, pero son
tres pasos manuales.

**Qué habría que hacer.** Una función en Supabase que guarde la clave de la API
y haga de intermediaria. La app la llama con la sesión del usuario.

**Coste real.** Con Sonnet, unos 3–5 céntimos por viaje generado. Cargando 5 $
hay para años. Requiere desplegar la función desde un ordenador.

**Cuidado con:** poner un límite de gasto mensual en la consola antes de nada, y
un tope de peticiones por usuario en la propia función. Una clave que no
controla el gasto es una factura esperando a pasar.

---

## 6 · Fotos vuestras en Eslovenia y Asturias

El sistema está montado desde la foto de Bled. Al volver del viaje, sustituir
los dibujos por fotos propias convierte la app en el recuerdo del viaje.

Las fotos se comprimen a unos 900 px antes de guardarlas. Ojo con el tope de
5 MB de `localStorage`: no meter cuarenta.

---

## 7 · Datos que faltan

- **Asturias:** las fechas de agosto, y los sitios de park4night de cada noche.
- **Eslovenia:** teléfonos de los alojamientos.

Sin las fechas, Asturias funciona con días numerados. En cuanto se pongan, la
app arranca sola en el día que toca.

---

## 8 · Enchufar Organic Maps

App de mapas que funciona entera sin conexión, con datos de OpenStreetMap: trae
caminos de montaña, fuentes y refugios que Google no tiene. Gratuita y sin
cuentas. Resuelve el punto 3 sin pelearse con las teselas.

**Qué falta.** Comprobar en un iPhone si responde al esquema `om://`. Si abre,
añadir un botón por parada como se hizo con Waze y park4night. Si no, dejar solo
el aviso de «descárgate la zona antes de salir».

**Cuidado con:** no está documentado. Igual que `p4n://`, hay que probarlo a
mano y anotar aquí el resultado.

---

## Ideas sin decidir

- **Presupuesto por viaje.** La app de gastos ya existe y está enlazada. Podría
  mostrar en el viaje cuánto lleváis gastado.
- **Copiar un día a otro viaje.** Útil cuando se repiten zonas.
- **Plantillas.** «Un fin de semana en la montaña» como punto de partida.
- **Modo conducción.** Letra grande y solo la siguiente parada.
- **Compartir un viaje con alguien de fuera** por enlace, sin cuenta.

---

## Cosas que se probaron y no funcionan

Para no perder el tiempo repitiéndolas:

| Idea | Por qué no |
|---|---|
| Coordenadas en la URL de Wikiloc (`?sw=&ne=`) | Las ignora y abre el mapa del mundo |
| `wikiloc://map?q=` y variantes | El esquema existe pero ignora toda ruta: abre en tu ubicación |
| Compartir sesión entre las apps del inicio | En iOS cada una tiene su almacén |
| `waze.com/ul?q=` desde una app instalada | Falla al saltar; hay que usar `waze://` |
| Bajar imágenes de bancos libres desde el asistente | La red del entorno no llega a esos dominios |
