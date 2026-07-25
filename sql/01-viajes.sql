-- ═══════════════════════════════════════════════════════════
--  Tabla de viajes compartidos
--  Pegar entero en Supabase → SQL Editor → Run
--  Proyecto: cmkzcvfjgrgxwqjimtxa
-- ═══════════════════════════════════════════════════════════

create table if not exists public.viajes (
  id           text primary key,
  nombre       text not null,
  desde        text default '',
  hasta        text default '',
  salida       text default '',
  dias         jsonb not null default '[]'::jsonb,
  autor        text default '',
  actualizado  timestamptz not null default now(),
  borrado      boolean not null default false
);

-- Para ordenar y detectar cambios rápido
create index if not exists viajes_actualizado_idx on public.viajes (actualizado desc);

-- ── Seguridad ──────────────────────────────────────────────
alter table public.viajes enable row level security;

-- Mismo criterio que ya usáis en los gastos:
-- quien haya iniciado sesión ve y edita los viajes.
-- (Sois dos y compartís todo; si algún día queréis separarlo,
--  se cambia por una comprobación de autor.)

drop policy if exists "viajes_lectura" on public.viajes;
create policy "viajes_lectura" on public.viajes
  for select to authenticated using (true);

drop policy if exists "viajes_insercion" on public.viajes;
create policy "viajes_insercion" on public.viajes
  for insert to authenticated with check (true);

drop policy if exists "viajes_edicion" on public.viajes;
create policy "viajes_edicion" on public.viajes
  for update to authenticated using (true) with check (true);

drop policy if exists "viajes_borrado" on public.viajes;
create policy "viajes_borrado" on public.viajes
  for delete to authenticated using (true);

-- ── Marca de tiempo automática al modificar ────────────────
create or replace function public.viajes_tocar()
returns trigger language plpgsql as $$
begin
  new.actualizado = now();
  return new;
end $$;

drop trigger if exists viajes_tocar_trg on public.viajes;
create trigger viajes_tocar_trg
  before update on public.viajes
  for each row execute function public.viajes_tocar();

-- ═══════════════════════════════════════════════════════════
--  Comprobación: debería devolver la tabla vacía, sin error
-- ═══════════════════════════════════════════════════════════
select * from public.viajes;
