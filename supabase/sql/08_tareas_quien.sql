-- Tareas: además de Lidia (L) y Miguel (M), «a medias» (LM, mitad de puntos para cada uno) y Ana (A, de fuera).
-- Pegar en Supabase > SQL Editor > New query > Run. Se puede volver a ejecutar sin romper nada.
alter table tareas_hechas drop constraint if exists tareas_hechas_quien_check;
alter table tareas_hechas add constraint tareas_hechas_quien_check check (quien in ('L', 'M', 'LM', 'A'));
