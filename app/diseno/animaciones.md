# PotugApp · Animaciones

Catálogo de las animaciones de la app y cómo reutilizarlas. Antes de animar algo nuevo, buscar aquí la pieza que ya existe.
Todo el código vive en `app/index.html` (CSS al principio, utilidades en el script).

## Reglas

1. **Solo `transform` y `opacity`.** Nada de animar `top`, `left`, `width`, `height` ni márgenes: obligan a recalcular la página en cada fotograma.
   Excepciones aceptadas (elemento pequeño y aislado): la burbuja del menú y la barra de Comer fuera.
2. **Solo lo que cambia por un toque propio.** No se anima: el cambio entre herramientas, los datos que se refrescan solos (calendario, tiempo, la lista cuando compra otro) ni el scroll.
3. **Cortas.** Gestos de respuesta 0,12–0,3 s; cambios de contenido 0,4 s; resaltados hasta 1,4 s. Al cerrar, más rápido que al abrir.
4. **Curva por defecto:** `cubic-bezier(0.2, 0.8, 0.2, 1)` (sale rápido y se posa). Rebote, si hace falta, suave: `cubic-bezier(0.3, 1.12, 0.5, 1)`.
5. **Modo simple.** Toda animación nueva respeta `ANIM`:
   - En JS: no lanzar nada si `!ANIM` (la utilidad `animar()` ya lo comprueba).
   - En CSS: la clase `.sin-anim` del `<html>` anula transiciones y animaciones (salvo `.tira`). Los estados `:active` van bajo `html:not(.sin-anim)`.
   - Modo simple automático en iOS ≤ 12 (iPad de la cocina); `?anim=no` / `?anim=si` lo fija en cada aparato (`localStorage potugapp.anim`).
6. **No cortar animaciones al repintar.** Tras una acción propia, el repintado con la respuesta del servidor espera a que acabe (`CV.tAccion` en Compra, `CFV.tAccion` en Comer fuera). Copiar este patrón en cada herramienta nueva con cola de acciones.

## Utilidad base

```js
animar(elemento, 'a-entra');   // reinicia la animación de esa clase y la quita al acabar
```

| Clase | Efecto | Duración | Uso típico |
|---|---|---|---|
| `.a-entra` | los hijos entran desde 12 px abajo y se funden | 0,42 s | contenido de una tarjeta que cambia (día del calendario) |
| `.a-der` / `.a-izq` | entra desde 32 px a un lado | 0,42 s | cambio de mes, de semana, de página interna (dirección según la flecha) |
| `.a-pop` | crece de 0,6 a 1,12 y se asienta | 0,4 s | algo que se marca o se elige (check, círculo del día) |
| `.a-latido` | se encoge a 0,92 y vuelve | 0,22 s | botón o pastilla que alterna estado (básicos) |
| `.a-nuevo` | entra desde 6 px arriba y se funde | 0,24 s | fila que aparece en una lista |
| `.a-resalta` | fondo acento que se apaga | 1,4 s | elemento recién añadido que hay que encontrar en una lista que se reordena |
| `.a-funde` | se funde de 0 a 1 | 0,4 s | datos que llegan por primera vez (tras el esqueleto) |

## Piezas reutilizables

### Pestañas con fondo que se desliza (`.seg-bola`)
Segmentado de dos opciones. Un `<i class="seg-bola"></i>` dentro del contenedor; las opciones van encima (`z-index: 1`) sin fondo propio.
Se coloca con una clase en el contenedor (`translateX(100%)` para la segunda). Ejemplos: Lista/Básicos (`#mCompra.v-bas`), Restaurante/Delivery (`.cf-seg.r` / `.cf-seg.d`, que además aparece fundiéndose si no había nada elegido).
Para 3 opciones: ancho `calc(33.33% - 4px)` y `translateX(100%)` / `translateX(200%)`.

### Hojas (ventanas)
Usar siempre `mostrarHoja()` y `cerrarHoja()` (nunca cambiar `#cpHoja.className` a mano).
Posición: en el móvil, siempre arriba (clase `.teclado`); en el iPad, centradas y arriba solo mientras se escribe; en el ordenador, centradas.
Entrada: velo negro de 0 a 75 % y hoja que sube 32 px con escala 0,97 → 1 (0,34 s). Salida: baja y se funde con curva que acelera (0,22 s).
Cualquier hoja nueva se pinta dentro de `#cpHojaIn` y hereda la animación.

### Lista que se recoloca (técnica FLIP)
`medirLista(cont)` antes de repintar y `deslizarLista(cont, antes)` después: cada fila se desliza desde donde estaba hasta su sitio nuevo (0,38 s); las filas nuevas entran con `.a-nuevo`.
Las filas se identifican por `data-id`; las cabeceras de grupo por su texto.
Patrón para acciones que mueven filas: primero el gesto en su sitio (p. ej. el check con `.a-pop`), y a los 450 ms la acción real que reordena.
Reutilizar en cualquier lista ordenada que cambie por un toque (tareas, gastos…).

### Cifra que cuenta y barra que crece
`rodarCifra(el, de, a, conDecimales)`: la cifra pasa del valor anterior al nuevo en 0,5 s (frena al final). Arranca mostrando el valor anterior.
Barra: se repinta con el ancho anterior y pasa al nuevo con la clase `crece-a` (0,5 s). En Comer fuera solo se lanza tras apuntar, borrar o cambiar el tope (`CFV.animBarra`).
Reutilizar en contadores y progresos (por ejemplo, tareas hechas en el mes).

### Calendario
`pintarPagCal(true)` solo desde toques (días, flechas, deslizar el mes): la tarjeta del día usa `.a-entra`, la rejilla del mes `.a-der`/`.a-izq` según la dirección y el círculo del día elegido `.a-pop`. Sin el `true` (refrescos, abrir la página) no anima.

### Respuesta al tocar
Botones, flechas y pastillas se encogen a 0,94 mientras el dedo está encima (0,12 s). Para un botón nuevo, añadir su selector a la lista de `:active` del bloque de animaciones del CSS.

### Burbuja del menú
Mancha negra única en el lateral del iPad (`#burT`) y en el menú del móvil (`#burM`). Al cambiar de página se estira hacia la opción nueva (0,2 s) y recoge el extremo de detrás con un rebote suave (0,3 s). `moverBurbujas(true)` desde `irPagina()`.
Probada y descartada: versión con tres piezas y `transform` (se partía en los extremos).

### Cambio de herramienta en el móvil
La pantalla nueva entra desde un lado (`.a-pag-der` / `.a-pag-izq`, 28 % y 0,32 s), según el orden del menú o la dirección del dedo (`DIR_DEDO`). Ajustes cuenta como la última. En iPad y ordenador el cambio es instantáneo.

### Portada del iPad
Páginas de widgets en una tira (`.portada > .tira > .filas`). El gesto lanza la animación sin seguir al dedo (`SEGUIR_DEDO = false`; con `true` sigue al dedo). En movimiento usa `translate3d`; quieta, `translateX` (una capa 3D quieta deja el texto borroso).

### Carga
Calendario y tiempo se guardan en el aparato y se pintan al abrir. La primera vez: esqueleto (`esq(ancho)`, barras grises que laten) y los datos entran con `.a-funde`.
Patrón para cualquier widget nuevo que dependa de internet: guardar la última respuesta, pintarla al arrancar y esqueleto solo si no hay nada guardado.
