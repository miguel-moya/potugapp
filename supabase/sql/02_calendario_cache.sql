-- Copia de seguridad de los calendarios (la escribe y lee solo la función "calendario").
-- Pegar en Supabase > SQL Editor > New query > Run
create table if not exists calendario_cache (
  fuente text primary key,
  eventos jsonb not null default '[]',
  actualizado timestamptz not null default now()
);
-- Seguridad activada y sin permisos públicos: solo la función (clave de servicio) puede usarla.
alter table calendario_cache enable row level security;
