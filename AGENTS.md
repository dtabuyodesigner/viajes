# Instrucciones para agentes

Este archivo es para cualquier IA que vaya a tocar este repositorio: Claude Code,
Antigravity o lo que venga. Léelo entero antes de escribir nada.

---

## Lo que más se ha roto, en una línea cada uno

Antes de tocar nada, leer esto. Son fallos ya cometidos:

1. **Si añades un archivo del que depende la app, dilo en los cinco `sw.js`.**
2. **El código común se pide sin `?v=`**: la versión la lleva el service worker.
3. **Recargar no aplica una versión nueva**: hay que pedir `skipWaiting`.
4. **`getRegistrations()` solo ve su carpeta**: recorrer las cinco a mano.
5. **Al unificar, comprobar el formato real de cada variable**, no suponerlo.
6. **Cambiar la lógica obliga a revisar los textos** que la describen.
7. **Enseña el motivo técnico del error**, no una frase amable.
8. **Ejecutar las pruebas en un comando aparte y leerlas** antes de subir.

---

## Las dos reglas que no se negocian

**1. Nunca se toca `main` directamente.** Todo va a `dev`. A `main` solo llega lo
que esté probado y cuando la persona lo pida. `main` es lo que hay publicado y
puede estar usándose en carretera ahora mismo.

**2. Todo cambio se documenta antes de darlo por terminado.** `README.md` si
cambia la estructura o los datos, `PENDIENTE.md` si se completa o aparece algo
nuevo, `USO.md` si cambia lo que ve la persona, y este archivo si se comete un
error del que se pueda aprender. No es papeleo: es lo que permite que la próxima
sesión no empiece de cero.

---

## Lo primero

```bash
node tests/probar.js
```

Si eso no sale en verde, **arregla lo que esté roto antes de añadir nada**.
Y vuelve a ejecutarlo antes de dar por terminado cualquier cambio.

---

## Qué es esto y para quién

Dos personas que viajan en furgoneta y en avión, con dos perras, por sitios de
montaña **sin cobertura**. La app se usa conduciendo, con una mano, con sol
dando en la pantalla y a veces con prisa.

Eso manda sobre todas las decisiones:

- **Sin cobertura tiene que funcionar todo** menos lo que sea obviamente de red.
- **Un botón que no responde es peor que un botón que no existe.**
- **Menos toques es mejor.** Nadie va a navegar tres menús en un cruce.
- **Si algo falla, decirlo en castellano llano**, no un código de error.

---

## Reglas técnicas

### Nada puede colgarse
Toda llamada de red va envuelta en `conTope()` (`sync.js`). Si añades una
llamada nueva, ponle tope. Un botón que se queda en «Cargando…» para siempre es
un fallo grave, no un detalle.

### `localStorage` siempre con `try/catch`
En modo privado de iOS lanza excepción. Sin el `catch`, la app entera se cae.

### El caché es traicionero
El código común (`sync.js`, `assets/app.js`, los `datos.js`) se pide **sin
`?v=`**: la versión la lleva el service worker. Si tocas cualquiera de esos
archivos, sube el `CACHE` de los `sw.js` que lo guardan. Si tocas una app, sube
su `const VERSION`. Ya ha pasado dos veces que el usuario viera una versión
antigua y pensara que algo estaba roto.

### Mover código: fotografiar antes
Si vas a refactorizar, `node tests/foto.js guardar` primero. Mueve **un bloque**,
`comparar`, sigue. Nunca cinco de golpe: si algo se rompe no sabrás cuál fue.

### Cada viaje son datos, no una app
Eslovenia y Asturias viven en `carpeta/datos.js` con un `VIAJE_ORIGINAL`. El
HTML pone la estructura y `assets/app.js` el motor. Si al añadir algo te sale
un `if` con el nombre del viaje dentro del motor, ese trozo no era común: hazlo
dato o bloque opcional.

Y si añades un `datos.js` nuevo, dilo en su `sw.js`. Hay una prueba que lo
vigila, pero es mejor no verla saltar.

### Nada de dependencias
Ni frameworks, ni compilación, ni `node_modules` en producción. Un archivo HTML
por app, con todo dentro. `jsdom` es solo para las pruebas.

### Al reemplazar código, comprueba dónde ha caído
Varias veces un reemplazo automático ha insertado un bloque dentro de otra
función, o ha coincidido con la primera de nueve apariciones. La sintaxis
quedaba válida y el fallo solo aparecía al usar la app. Después de un reemplazo,
mira el resultado, no solo `node --check`.

### No inventes URLs ni esquemas
Se subieron 34 enlaces de Wikiloc con un formato inventado que daba 404.
Si no puedes comprobar una URL, **no la pongas**: dilo y pide que se compruebe.

### Nada de claves de API
El repositorio es público. Si algo necesita una clave, va en una función de
Supabase, no aquí.

---

## Cómo escribir

Los textos que ve el usuario van en **castellano**, en tono llano y directo.

- «No se pudo conectar» mejor que «Error 500».
- «El aparcamiento se llena antes de las 9» mejor que «Aparcamiento limitado».
- Sin emoji en la interfaz salvo que aporten algo (☂ para el plan B, por ejemplo).
- Sin exclamaciones ni entusiasmo de folleto.

En el código, nombres en castellano: `pintaDias`, `buscarCerca`, `viaje.paradas`.
Es lo que hay y mezclar idiomas lo hace peor.

---

## Antes de publicar

1. `node tests/probar.js` en verde — **y leer el resultado**, no solo lanzarlo
2. Si has movido código, `node tests/foto.js comparar` también en verde
3. Subir `VERSION` y, si toca, el `?v=` de `sync.js` y de `assets/app.js`
4. Actualizar la documentación que corresponda
5. Subir **a `dev`**
6. Mezclar a `main` solo cuando la persona lo pida
7. Comprobar que el build de GitHub Pages termina en `built`

`main` es lo que hay publicado. Puede estar usándose **en carretera ahora
mismo**. No se sube nada a `main` sin probar.

---

## Errores que ya se cometieron

Están aquí para que no se repitan:

| Qué pasó | Por qué | Cómo evitarlo |
|---|---|---|
| La pestaña Reservas se quedó en blanco | Al reescribir, se borró el bloque `alojamientos` que otro código usaba | Ejecutar la app, no solo comprobar la sintaxis |
| 34 enlaces de Wikiloc daban 404 | Se inventó el formato de la URL | Verificar antes de publicar |
| El botón de entrar se quedaba colgado | `sync.js` viejo en caché, sin la función nueva | Versionar `sync.js` en la URL |
| La portada decía «comprobando…» para siempre | `getSession()` sin tope de tiempo | Todo con `conTope()` |
| Se dio por hecho que la sesión se compartía | En iOS cada app de la pantalla de inicio tiene su almacén | No suponer: comprobar |
| Al cambiar de tema, el estado volvía a «comprobando…» | Repintar el pie destruía el elemento y nadie recalculaba | Guardar el último estado y repintarlo |
| Una prueba daba verde con el fallo puesto | Comprobaba «no empieza por comprobando», y el texto vacío también cumple | Escribir la prueba, meter el fallo a propósito y ver que salta |
| La barra inferior seguía oscura en modo claro | Al reorganizar el CSS se borraron las reglas `body.claro nav{…}` | Atar los fondos a variables, no escribir colores |
| Textos de las fichas invisibles con sol | Colores claros escritos a mano, pensados para fondo oscuro | Todo el texto con variables del tema |
| `navegarXY` usada sin estar definida | La condición de inserción buscaba un texto que no existía en esas apps | Prueba nueva: funciones usadas y no definidas |
| El botón del tiempo llevaba a un hotel | Se le pasaba el nombre del alojamiento a una búsqueda de Google | Usar coordenadas, y traer el dato dentro de la app |
| Segunda prueba que no detectaba su fallo | El ancla de la expresión regular fallaba con un comentario delante | Verificar SIEMPRE en los dos sentidos |
| Las fotos salían en todos los días | El día se dibuja dos veces y ambos usaban los mismos ids | Parámetro `ctx`: `hoy` y `det` |
| El botón «situarme» roto en el visor | Allí la función se llama `ubicacion()`, no `pedirUbicacion()` | La prueba de funciones sin definir lo cazó |
| Se publicó con una prueba en rojo | Se lanzó la subida sin mirar el resultado | Leer la salida antes de subir, no después |
| Los servicios salían desordenados | Se ordenaban en recto y los tiempos reales se metían en su sitio sin reordenar | Ya estaba corregido en otro bloque: el motor común evita repetir el fallo |
| «Nada en 100 km» con gasolineras | Overpass se atraganta con miles de resultados y devuelve 504 | Tope y timeout según el radio, y decir qué pasa |
| «Demasiados resultados en 10 km» | Se culpaba al radio de un fallo del servidor, sin reintentar | Tres servidores alternativos y tres intentos pidiendo menos cada vez |
| Se volvió a publicar con pruebas en rojo | Segunda vez. Se lanzó la subida en el mismo comando que las pruebas, sin leer la salida | **Ejecutar las pruebas en un comando aparte, leerlas, y solo entonces subir** |
| El motor usaba `distancia()` y el visor `distKm()` | Al unificar, los nombres deben unificarse también | La prueba de funciones sin definir lo cazó al enseñarle qué es el motor |
| La fotografía saltaba al cambiar un comentario | `_pagina` guardaba el `body` entero, y ahí van inyectados `sync.js` y el motor: comparaba código, no lo pintado | `normaliza()` vacía los `<script>`. Si la red de seguridad avisa de lo que no importa, deja de servir para lo que importa |
| Una prueba daba verde comparando dos `undefined` | Miraba `window.VIAJE`, pero un `const` de un script normal **no** se cuelga de `window`. Comparaba `undefined === undefined` | Comprobar lo que se pinta en el DOM, no las variables. Y desconfiar de una prueba que pasa a la primera |
| Reservas, normas y guía se borraban solas al sincronizar | `subir()` no mandaba esos campos y `_sincronizar()` **sustituía** el viaje local por el de la nube | Al fundir, partir de lo local y poner la nube encima. Lo que la nube no sepa llevar no puede borrarlo |
| Las pestañas Info y Reservas reventaban con un viaje editado | Un viaje creado en el editor no trae `info`, ni `vuelos`, ni `seguros`. El código los daba por seguros | Todo bloque que no tengan los dos viajes es opcional: `(VIAJE.x \|\| [])`, y el bloque vacío no se pinta |

El patrón se repite: **dar algo por bueno sin ejecutarlo**. Por eso existen las
pruebas.

Y un aviso sobre las pruebas mismas: **una prueba que nunca has visto fallar no
sirve de nada**. Después de escribirla, reintroduce el fallo a propósito y
comprueba que salta. Si pasa igual, la prueba está mal.

---

## Cómo se publica

```bash
node tests/probar.js              # las 146 en verde, y LEER el resultado
node tests/foto.js comparar       # si has movido código
# subir VERSION, y el CACHE del sw.js de cada app que toques
#   (el código común va SIN ?v=: la versión la lleva el service worker)
# actualizar README / PENDIENTE / USO / AGENTS según toque
git checkout dev && git commit -am "…" && git push origin dev
# …y parar aquí. A main solo cuando lo pidan.
```

Y comprobar que el build de GitHub Pages acaba en `built`. Si sale `errored`,
suele ser porque dos commits seguidos lanzaron dos builds a la vez: el siguiente
lo arregla solo. Mirar el historial antes de asustarse.
