-- Básicos definitivos (elegidos en la página «Básicos de la compra»). Pegar en SQL Editor y Run.
-- No toca la lista de la compra: lo que ya esté apuntado se queda.

-- Grupo de limpieza: nuevo nombre y absorbe al de Gato
update compra_grupos set nombre = 'Limpieza, hogar y mascotas' where nombre = 'Limpieza y hogar';
update compra_basicos set grupo_id = (select id from compra_grupos where nombre = 'Limpieza, hogar y mascotas')
  where grupo_id = (select id from compra_grupos where nombre = 'Gato')
  and nombre not in (select nombre from compra_basicos where grupo_id = (select id from compra_grupos where nombre = 'Limpieza, hogar y mascotas'));
update compra_lista set grupo_id = (select id from compra_grupos where nombre = 'Limpieza, hogar y mascotas')
  where grupo_id = (select id from compra_grupos where nombre = 'Gato');
delete from compra_grupos where nombre = 'Gato';

-- Nombres cambiados
update compra_basicos set nombre = 'Tortillas tacos' where nombre = 'Tortillas para tacos / wraps';
update compra_basicos set nombre = 'Queso mahonés' where nombre = 'Queso Mahón';
update compra_lista set nombre = 'Tortillas tacos' where nombre = 'Tortillas para tacos / wraps';
update compra_lista set nombre = 'Queso mahonés' where nombre = 'Queso Mahón';

-- La lista definitiva
create temp table basicos_fin (nombre text, grupo text, orden int);
insert into basicos_fin values
  ('Ensalada (canónigos, rúcula, brotes)', 'Frutas y verduras', 1),
  ('Zanahorias', 'Frutas y verduras', 2),
  ('Frutos rojos', 'Frutas y verduras', 3),
  ('Tomates', 'Frutas y verduras', 4),
  ('Plátanos', 'Frutas y verduras', 5),
  ('Pimientos', 'Frutas y verduras', 6),
  ('Brócoli', 'Frutas y verduras', 7),
  ('Champiñones', 'Frutas y verduras', 8),
  ('Limones / limas', 'Frutas y verduras', 9),
  ('Aguacates', 'Frutas y verduras', 10),
  ('Patatas / boniato', 'Frutas y verduras', 11),
  ('Tomates cherry', 'Frutas y verduras', 12),
  ('Calabacín', 'Frutas y verduras', 13),
  ('Cebollas', 'Frutas y verduras', 14),
  ('Kiwis', 'Frutas y verduras', 15),
  ('Puerros', 'Frutas y verduras', 16),
  ('Manzanas', 'Frutas y verduras', 17),
  ('Muslos / contramuslos', 'Carne y pescado', 1),
  ('Solomillo de pollo', 'Carne y pescado', 2),
  ('Carne preparada (carrilladas, albóndigas…)', 'Carne y pescado', 3),
  ('Carne picada', 'Carne y pescado', 4),
  ('Pechugas de pollo', 'Carne y pescado', 5),
  ('Alitas', 'Carne y pescado', 6),
  ('Hamburguesas', 'Carne y pescado', 7),
  ('Pescado', 'Carne y pescado', 8),
  ('Formitas pescado', 'Carne y pescado', 9),
  ('Embutido curado', 'Charcutería y quesos', 1),
  ('Queso cottage', 'Charcutería y quesos', 2),
  ('Aceitunas', 'Charcutería y quesos', 3),
  ('Mozzarella', 'Charcutería y quesos', 4),
  ('Fiambre (pavo, lomo asado, pollo)', 'Charcutería y quesos', 5),
  ('Grana padano', 'Charcutería y quesos', 6),
  ('Queso feta', 'Charcutería y quesos', 7),
  ('Gildas', 'Charcutería y quesos', 8),
  ('Queso fresco / requesón', 'Charcutería y quesos', 9),
  ('Queso roquefort', 'Charcutería y quesos', 10),
  ('Queso rallado', 'Charcutería y quesos', 11),
  ('Queso mahonés', 'Charcutería y quesos', 12),
  ('Hummus', 'Charcutería y quesos', 13),
  ('Huevos', 'Lácteos y huevos', 1),
  ('Flanes proteicos', 'Lácteos y huevos', 2),
  ('Leche', 'Lácteos y huevos', 3),
  ('Natillas proteicas', 'Lácteos y huevos', 4),
  ('Yogur griego', 'Lácteos y huevos', 5),
  ('Margarina', 'Lácteos y huevos', 6),
  ('Yogures de sabores', 'Lácteos y huevos', 7),
  ('Frutos secos', 'Despensa', 1),
  ('Tortitas (arroz / maíz / legumbre)', 'Despensa', 2),
  ('Tortillas tacos', 'Despensa', 3),
  ('Pan', 'Despensa', 4),
  ('Pasta sin gluten', 'Despensa', 5),
  ('Caldo', 'Despensa', 6),
  ('Copos de avena', 'Despensa', 7),
  ('Atún en lata', 'Despensa', 8),
  ('Galletas', 'Despensa', 9),
  ('Encurtidos', 'Despensa', 10),
  ('Miel', 'Despensa', 11),
  ('Tomate (rallado / frito)', 'Despensa', 12),
  ('Legumbre cocida', 'Despensa', 13),
  ('Maíz dulce', 'Despensa', 14),
  ('Arroz', 'Despensa', 15),
  ('Café', 'Despensa', 16),
  ('Aceite', 'Despensa', 17),
  ('Tés', 'Despensa', 18),
  ('Manzanilla', 'Despensa', 19),
  ('Tomate triturado', 'Despensa', 20),
  ('Chili con carne', 'Preparados y congelados', 1),
  ('Ñoquis', 'Preparados y congelados', 2),
  ('Tortilla de patatas', 'Preparados y congelados', 3),
  ('Patatas cocidas', 'Preparados y congelados', 4),
  ('Crema de verduras', 'Preparados y congelados', 5),
  ('Isotónico', 'Bebidas', 1),
  ('Cerveza', 'Bebidas', 2),
  ('Vino', 'Bebidas', 3),
  ('Friegasuelos', 'Limpieza, hogar y mascotas', 1),
  ('Bolsas de basura', 'Limpieza, hogar y mascotas', 2),
  ('Lavavajillas', 'Limpieza, hogar y mascotas', 3),
  ('Limpiador con oxígeno', 'Limpieza, hogar y mascotas', 4),
  ('Elimina olores', 'Limpieza, hogar y mascotas', 5),
  ('Gel WC', 'Limpieza, hogar y mascotas', 6),
  ('Comida gato', 'Limpieza, hogar y mascotas', 7),
  ('Insecticida', 'Limpieza, hogar y mascotas', 8),
  ('Multiusos / desengrasante', 'Limpieza, hogar y mascotas', 9),
  ('Desinfectante', 'Limpieza, hogar y mascotas', 10),
  ('Papel de cocina', 'Limpieza, hogar y mascotas', 11),
  ('Papel vegetal / moldes', 'Limpieza, hogar y mascotas', 12),
  ('Papel WC', 'Limpieza, hogar y mascotas', 13),
  ('Recambio fregona', 'Limpieza, hogar y mascotas', 14),
  ('Ambientador', 'Limpieza, hogar y mascotas', 15),
  ('Bayetas', 'Limpieza, hogar y mascotas', 16),
  ('Limpia lavadoras', 'Limpieza, hogar y mascotas', 17),
  ('Vinagre de limpieza', 'Limpieza, hogar y mascotas', 18),
  ('Amoníaco', 'Limpieza, hogar y mascotas', 19),
  ('Sal lavavajillas', 'Limpieza, hogar y mascotas', 20),
  ('Abrillantador lavavajillas', 'Limpieza, hogar y mascotas', 21),
  ('Bastoncillos oídos', 'Higiene', 1),
  ('Pasta dientes', 'Higiene', 2);

insert into compra_basicos (nombre, grupo_id, orden)
select f.nombre, g.id, f.orden from basicos_fin f join compra_grupos g on g.nombre = f.grupo
on conflict (grupo_id, nombre) do update set orden = excluded.orden;

-- Se quitan solo los de la propuesta provisional que no habéis elegido
-- (si ya habéis creado algún básico desde la app, se respeta)
delete from compra_basicos b using compra_grupos g
where b.grupo_id = g.id
  and not exists (select 1 from basicos_fin f where f.nombre = b.nombre and f.grupo = g.nombre)
  and b.nombre in ('Huevos', 'Flanes proteicos', 'Frutos secos', 'Ensalada (canónigos, rúcula, brotes)', 'Embutido curado', 'Zanahorias', 'Tortitas (arroz / maíz / legumbre)', 'Frutos rojos', 'Tomates', 'Leche', 'Natillas proteicas', 'Plátanos', 'Yogur griego', 'Pimientos', 'Queso cottage', 'Tortillas para tacos / wraps', 'Friegasuelos', 'Aceitunas', 'Brócoli', 'Mozzarella', 'Champiñones', 'Cosas mexicanas (salsa, sazonador, nachos)', 'Fiambre (pavo, lomo asado, pollo)', 'Grana padano', 'Limones / limas', 'Margarina', 'Muslos / contramuslos', 'Pan', 'Pasta sin gluten', 'Queso feta', 'Solomillo de pollo', 'Bolsas de basura', 'Gildas', 'Caldo', 'Carne preparada (carrilladas, albóndigas…)', 'Aguacates', 'Carne picada', 'Copos de avena', 'Patatas / boniato', 'Pechugas de pollo', 'Queso fresco / requesón', 'Queso roquefort', 'Tomates cherry', 'Yogures de sabores', 'Lavavajillas', 'Alitas', 'Isotónico', 'Atún en lata', 'Calabacín', 'Cebollas', 'Chili con carne', 'Galletas', 'Hamburguesas', 'Limpiador con oxígeno', 'Queso rallado', 'Ñoquis', 'Tortilla de patatas', 'Cerveza', 'Elimina olores', 'Gel WC', 'Kiwis', 'Insecticida', 'Multiusos / desengrasante', 'Desinfectante', 'Papel de cocina', 'Papel vegetal / moldes', 'Papel WC', 'Recambio fregona', 'Ambientador', 'Bayetas', 'Limpia lavadoras', 'Vinagre de limpieza', 'Amoníaco');

-- Grupos sin básicos fuera
delete from compra_grupos g where not exists (select 1 from compra_basicos b where b.grupo_id = g.id);
