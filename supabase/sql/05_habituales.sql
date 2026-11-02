-- Widget de Compra: «habituales» (cuántas veces se apunta cada básico) y quién tacha (para «en el súper»).
-- Pegar en SQL Editor y Run.
-- OJO: ejecutarlo de nuevo más adelante vuelve a poner los contadores a cero.
alter table compra_basicos add column if not exists veces int not null default 0;
alter table compra_lista add column if not exists tachado_por text;

-- Empezamos de cero, salvo 10 habituales de partida (los que más salían en los tickets), Huevos el primero
update compra_basicos set veces = 0;
update compra_basicos b set veces = v.n from (values
  ('Huevos', 10), ('Leche', 9), ('Plátanos', 8), ('Flanes proteicos', 7), ('Frutos secos', 6),
  ('Ensalada (canónigos, rúcula, brotes)', 5), ('Embutido curado', 4), ('Zanahorias', 3), ('Tomates', 2), ('Frutos rojos', 1)
) as v(nombre, n) where b.nombre = v.nombre;
