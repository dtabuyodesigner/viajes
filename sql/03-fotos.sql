-- ═══════════════════════════════════════════════════════════
--  Fotos compartidas de los viajes
--  Pegar entero en Supabase → SQL Editor → Run
--  Proyecto: cmkzcvfjgrgxwqjimtxa
-- ═══════════════════════════════════════════════════════════

create table if not exists public.viaje_fotos (
  id       text primary key,        -- viaje:dia:marcadetiempo
  viaje    text not null,           -- 'eslovenia', 'asturias' o el id del viaje creado
  dia      int  not null,           -- índice del día, empezando en 0
  datos    text not null,           -- la imagen, ya comprimida, en base64
  autor    text default '',
  cuando   timestamptz not null default now(),
  borrada  boolean not null default false
);

-- Para pedir solo las de un día sin recorrer toda la tabla
create index if not exists viaje_fotos_dia_idx on public.viaje_fotos (viaje, dia, borrada);

-- ── Seguridad: igual que las otras tablas ──────────────────
alter table public.viaje_fotos enable row level security;

drop policy if exists "fotos_lectura" on public.viaje_fotos;
create policy "fotos_lectura" on public.viaje_fotos
  for select to authenticated using (true);

drop policy if exists "fotos_insercion" on public.viaje_fotos;
create policy "fotos_insercion" on public.viaje_fotos
  for insert to authenticated with check (true);

drop policy if exists "fotos_edicion" on public.viaje_fotos;
create policy "fotos_edicion" on public.viaje_fotos
  for update to authenticated using (true) with check (true);

drop policy if exists "fotos_borrado" on public.viaje_fotos;
create policy "fotos_borrado" on public.viaje_fotos
  for delete to authenticated using (true);

-- ═══════════════════════════════════════════════════════════
--  Comprobación: debe devolver la tabla vacía, sin error
-- ═══════════════════════════════════════════════════════════
select id, viaje, dia, autor, cuando from public.viaje_fotos;
