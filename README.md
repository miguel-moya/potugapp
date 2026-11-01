# PotugApp

Dashboard familiar para el iPad de la cocina y los móviles de casa.

- **App:** `app/` → la publica GitHub Pages (`.github/workflows/pages.yml`) en https://miguel-moya.github.io/potugapp/. `app/index.html` es la pantalla principal.
- **Diseño:** `app/diseno/marca.html` (manual de marca, fuente de verdad) y las maquetas.
- **Datos:** Supabase. La función `supabase/functions/calendario` lee los calendarios de Google.

## Reglas para iOS 10 (iPad de la cocina)
- Nada de `gap`: separaciones con márgenes (`.x > * + * { margin-top: … }`).
- Alturas repartidas con flex, no con rejilla CSS.
- Un `<button>` no puede ser contenedor flex: poner un `<span>` dentro.
- JavaScript ES5 y `XMLHttpRequest`.

## Calendario: puesta en marcha (una sola vez)

### 1. Cuenta de servicio de Google (Google limita las descargas .ics desde la nube)
1. console.cloud.google.com → proyecto nuevo `potugapp`.
2. APIs y servicios → Biblioteca → **Google Calendar API** → Habilitar.
3. IAM y administración → Cuentas de servicio → Crear `potugapp-calendario` (sin roles) → Claves → Agregar clave → JSON.
4. En Google Calendar, compartir cada calendario con el email de la cuenta de servicio → "Ver todos los detalles del evento".
5. Copiar el **ID de calendario** de cada uno (Configuración → calendario → Integrar el calendario).

### 1b. Secretos en Supabase
Supabase → proyecto `familia` → **Edge Functions → Secrets**:

| Nombre | Valor |
|---|---|
| `FAMILY_KEY` | la clave familiar |
| `GOOGLE_SA` | el contenido completo del JSON de la cuenta de servicio |
| `CAL_LIDIA`, `CAL_MIGUEL`, `CAL_BRUNO`, `CAL_FAMILIA`, `CAL_FESTIVOS` | el **ID de calendario** (o, como alternativa, la dirección .ics) |

Tabla de copia: ejecutar `supabase/sql/02_calendario_cache.sql` en el SQL Editor.

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
