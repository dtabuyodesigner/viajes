-- ═══════════════════════════════════════════════════════════
--  Que un viaje pueda llevar más cosas sin rehacer la tabla
--  Pegar entero en Supabase → SQL Editor → Run
--  Proyecto: cmkzcvfjgrgxwqjimtxa
-- ═══════════════════════════════════════════════════════════
--
--  Hasta ahora la tabla `viajes` solo guardaba nombre, fechas,
--  punto de salida y días. Todo lo demás —reservas, normas,
--  guía de lugares, seguros, teléfonos— se quedaba en el móvil
--  y no llegaba al otro. Peor todavía: al sincronizar, el viaje
--  local se sustituía por el de la nube y esos bloques se
--  perdían.
--
--  `extra` guarda todo lo que no tiene columna propia. Un bloque
--  nuevo que se invente más adelante entra aquí sin volver a
--  tocar el SQL.
--
--  Se puede aplicar con la app en marcha: mientras esta columna
--  no exista, `sync.js` sube el viaje sin ella y el móvil
--  conserva sus bloques igual.
-- ═══════════════════════════════════════════════════════════

alter table public.viajes
  add column if not exists extra jsonb not null default '{}'::jsonb;

-- ═══════════════════════════════════════════════════════════
--  Comprobación: la columna debe aparecer en la lista
-- ═══════════════════════════════════════════════════════════
select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'viajes'
 order by ordinal_position;
