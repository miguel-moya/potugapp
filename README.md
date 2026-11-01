# PotugApp

Dashboard familiar para el iPad de la cocina y los móviles de casa.

- **App:** `app/` → la publica Netlify tal cual (sin compilación). `app/index.html` es la pantalla principal.
- **Diseño:** `app/diseno/marca.html` (manual de marca, fuente de verdad) y las maquetas.
- **Datos:** Supabase. La función `supabase/functions/calendario` lee los calendarios de Google.

## Reglas para iOS 10 (iPad de la cocina)
- Nada de `gap`: separaciones con márgenes (`.x > * + * { margin-top: … }`).
- Alturas repartidas con flex, no con rejilla CSS.
- Un `<button>` no puede ser contenedor flex: poner un `<span>` dentro.
- JavaScript ES5 y `XMLHttpRequest`.

## Calendario: puesta en marcha (una sola vez)

### 1. Secretos en Supabase
Supabase → proyecto `familia` → **Edge Functions → Secrets** → añadir:

| Nombre | Valor |
|---|---|
| `FAMILY_KEY` | la clave familiar |
| `CAL_LIDIA` | dirección secreta iCal del calendario de Lidia |
| `CAL_MIGUEL` | ídem Miguel |
| `CAL_BRUNO` | ídem Bruno |
| `CAL_FAMILIA` | ídem Familia |
| `CAL_FESTIVOS` | dirección iCal del calendario de festivos |

### 2. Crear la función
Supabase → **Edge Functions → Deploy a new function → Via Editor**
- Nombre: `calendario`
- Pegar el contenido de `supabase/functions/calendario/index.ts`
- Deploy.
- En los ajustes de la función, **desactivar "Verify JWT"** (la función comprueba la clave familiar por su cuenta).

### 3. Probar
Abrir la app: pedirá la clave familiar una vez y mostrará el calendario.

## Identidad por dirección
- `?cocina` → iPad de la cocina (modo reposo a los 2 min).
- `?lidia`, `?miguel` → móviles (vistas personales en fases siguientes).

## Pendiente de seguridad
La tabla `items` de la Fase 1 sigue abierta a cualquiera con la clave pública. Se cerrará al construir Compra.
