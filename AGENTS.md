# Instrucciones para agentes

Este archivo es para cualquier IA que vaya a tocar este repositorio: Claude Code,
Antigravity o lo que venga. Léelo entero antes de escribir nada.

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
Si tocas `sync.js`, sube el `?v=NN` en las tres páginas que lo cargan. Si tocas
una app, sube su `const VERSION`. Ya ha pasado dos veces que el usuario viera
una versión antigua y pensara que algo estaba roto.

### Nada de dependencias
Ni frameworks, ni compilación, ni `node_modules` en producción. Un archivo HTML
por app, con todo dentro. `jsdom` es solo para las pruebas.

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

1. `node tests/probar.js` en verde
2. Subir `VERSION` y, si toca, el `?v=` de `sync.js`
3. Trabajar en `dev`, mezclar a `main` solo lo probado
4. Comprobar que el build de GitHub Pages termina en `built`

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

El patrón se repite: **dar algo por bueno sin ejecutarlo**. Por eso existen las
pruebas.

Y un aviso sobre las pruebas mismas: **una prueba que nunca has visto fallar no
sirve de nada**. Después de escribirla, reintroduce el fallo a propósito y
comprueba que salta. Si pasa igual, la prueba está mal.
