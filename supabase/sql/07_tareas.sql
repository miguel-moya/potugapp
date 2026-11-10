-- Tareas de casa: catálogo de tareas (con su frecuencia y puntos) y registro de quién hizo qué.
-- Las lee y escribe solo la función "tareas" (clave de servicio).
-- Pegar entero en Supabase > SQL Editor > New query > Run. Se puede volver a ejecutar sin romper nada.

create table if not exists tareas (
  id text primary key,                          -- lo genera el aparato (las de partida: t01, t02…)
  nombre text not null,
  puntos int,                                   -- null si la tarea tiene formas (cada forma lleva sus puntos)
  veces int not null default 1 check (veces between 1 and 31),
  periodo text not null default 's' check (periodo in ('s', 'm', 'a')),   -- s = semana, m = mes, a = año
  formas jsonb not null default '[]',           -- [{"n":"Tendida","p":100},{"n":"Secadora","p":50}]
  pausada boolean not null default false,
  pospuesta date,                               -- no aparece como pendiente hasta ese día
  borrada boolean not null default false,       -- se oculta pero el historial conserva su nombre
  orden int not null default 0,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);

create table if not exists tareas_hechas (
  id text primary key,                          -- lo genera el aparato (sirve para reintentar sin duplicar)
  tarea_id text not null,
  nombre text not null,                         -- nombre de la tarea en ese momento
  dia date not null,
  quien text not null check (quien in ('L', 'M')),
  puntos int not null,
  forma text,
  rescate boolean not null default false,       -- estaba atrasada: +50 %
  creado timestamptz not null default now()
);
create index if not exists tareas_hechas_dia on tareas_hechas (dia);
create index if not exists tareas_hechas_tarea on tareas_hechas (tarea_id, dia);

-- Seguridad: activada y sin permisos públicos. Solo la clave de servicio (la función) entra.
alter table tareas enable row level security;
alter table tareas_hechas enable row level security;
grant all on table tareas, tareas_hechas to service_role;

-- Catálogo de partida (acordado el 10 nov 2026). Si ya existen, no se tocan.
insert into tareas (id, nombre, puntos, veces, periodo, formas, orden) values
  ('t01', 'Poner lavadora',                  50,   3, 's', '[]', 1),
  ('t02', 'Secar ropa',                      null, 3, 's', '[{"n":"Tendida","p":100},{"n":"Secadora","p":50}]', 2),
  ('t03', 'Doblar y recoger ropa',           150,  2, 's', '[]', 3),
  ('t04', 'Planchar',                        200,  1, 's', '[]', 4),
  ('t05', 'Repasar el baño',                 100,  1, 's', '[]', 5),
  ('t06', 'Repasar el aseo',                 100,  1, 's', '[]', 6),
  ('t07', 'Cambiar sábanas y fundas',        100,  2, 'm', '[]', 7),
  ('t08', 'Lavar y secar sábanas y toallas', 100,  2, 'm', '[]', 8),
  ('t09', 'Doblar y guardar sábanas',        50,   2, 'm', '[]', 9),
  ('t10', 'Limpiar cafetera a fondo',        50,   3, 'm', '[]', 10),
  ('t11', 'Descalcificar cafetera',          100,  4, 'a', '[]', 11)
on conflict (id) do nothing;
