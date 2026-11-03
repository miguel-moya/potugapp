-- Comer fuera: gastos en restaurantes y delivery, tope por mes y saldados entre Lidia y Miguel.
-- Las lee y escribe solo la función "comer" (clave de servicio).
-- Pegar entero en Supabase > SQL Editor > New query > Run. Se puede volver a ejecutar sin romper nada.

create table if not exists comer_gastos (
  id text primary key,                         -- lo genera el aparato (sirve para reintentar sin duplicar)
  fecha date not null,
  importe numeric(8,2) not null check (importe > 0),
  sitio text not null,
  tipo text not null check (tipo in ('r', 'd')),        -- r = restaurante, d = delivery
  paga text not null check (paga in ('L', 'M', 'F')),   -- F = cuenta común (no cuenta en el saldo)
  apuntado_por text,
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists comer_gastos_fecha on comer_gastos (fecha);

-- Tope de cada mes ('2026-11'). Un mes sin fila usa el del último mes anterior que tenga.
create table if not exists comer_topes (
  mes text primary key,
  tope numeric(8,2) not null check (tope > 0)
);

-- Cada «Saldar»: el saldo que había en ese momento (> 0: Miguel debía a Lidia; < 0: al revés)
create table if not exists comer_saldados (
  id text primary key,
  fecha timestamptz not null default now(),
  importe numeric(8,2) not null,
  quien text
);

-- Seguridad: activada y sin permisos públicos. Solo la clave de servicio (la función) entra.
alter table comer_gastos enable row level security;
alter table comer_topes enable row level security;
alter table comer_saldados enable row level security;
grant all on table comer_gastos, comer_topes, comer_saldados to service_role;

-- Tope de prueba: 300 € desde noviembre de 2026
insert into comer_topes (mes, tope) values ('2026-11', 300) on conflict (mes) do nothing;
