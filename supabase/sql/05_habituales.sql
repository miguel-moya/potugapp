-- Widget de Compra: «habituales» (cuántas veces se apunta cada básico) y quién tacha (para «en el súper»).
-- Pegar en SQL Editor y Run.
-- OJO: ejecutarlo de nuevo más adelante vuelve a poner los contadores a cero.
alter table compra_basicos add column if not exists veces int not null default 0;
alter table compra_lista add column if not exists tachado_por text;

-- Empezamos de cero; solo Huevos arranca con 1 para salir el primero
update compra_basicos set veces = 0;
update compra_basicos set veces = 1 where nombre = 'Huevos';
