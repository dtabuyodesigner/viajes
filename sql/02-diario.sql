-- ═══════════════════════════════════════════════════════════
--  Diario compartido: paradas marcadas y notas de cada día
--  Pegar entero en Supabase → SQL Editor → Run
--  Proyecto: cmkzcvfjgrgxwqjimtxa
-- ═══════════════════════════════════════════════════════════

create table if not exists public.viaje_diario (
  viaje        text primary key,   -- 'eslovenia', 'asturias' o el id del viaje creado
  hechas       jsonb not null default '{}'::jsonb,   -- { "0:1": marca_de_tiempo }
  desmarcadas  jsonb not null default '{}'::jsonb,   -- { "0:1": marca_de_tiempo }
  notas        jsonb not null default '{}'::jsonb,   -- { "0": {"t":"texto","ts":123} }
  actualizado  timestamptz not null default now()
);

-- ── Seguridad: igual que los viajes y los gastos ───────────
alter table public.viaje_diario enable row level security;

drop policy if exists "diario_lectura" on public.viaje_diario;
create policy "diario_lectura" on public.viaje_diario
  for select to authenticated using (true);

drop policy if exists "diario_insercion" on public.viaje_diario;
create policy "diario_insercion" on public.viaje_diario
  for insert to authenticated with check (true);

drop policy if exists "diario_edicion" on public.viaje_diario;
create policy "diario_edicion" on public.viaje_diario
  for update to authenticated using (true) with check (true);

drop policy if exists "diario_borrado" on public.viaje_diario;
create policy "diario_borrado" on public.viaje_diario
  for delete to authenticated using (true);

-- ── Marca de tiempo automática ─────────────────────────────
create or replace function public.diario_tocar()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

drop trigger if exists diario_tocar_trg on public.viaje_diario;
create trigger diario_tocar_trg
  before update on public.viaje_diario
  for each row execute function public.diario_tocar();

-- ═══════════════════════════════════════════════════════════
--  Comprobación: debe devolver la tabla vacía, sin error
-- ═══════════════════════════════════════════════════════════
select * from public.viaje_diario;
