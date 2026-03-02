-- ══════════════════════════════════════════════════════════
-- Tabela: monthly_snapshots (um registro por mês por usuário)
-- ══════════════════════════════════════════════════════════
create table if not exists public.monthly_snapshots (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade not null,
  month      text not null,   -- formato 'YYYY-MM'
  receita    numeric(12,2) not null default 0,
  fixas      numeric(12,2) not null default 0,
  cartao     numeric(12,2) not null default 0,
  invest     numeric(12,2) not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint snapshots_one_per_month unique (user_id, month)
);

alter table public.monthly_snapshots enable row level security;

create policy "Users read own snapshots"
  on public.monthly_snapshots for select
  using (auth.uid() = user_id);

create policy "Users insert own snapshots"
  on public.monthly_snapshots for insert
  with check (auth.uid() = user_id);

create policy "Users update own snapshots"
  on public.monthly_snapshots for update
  using (auth.uid() = user_id);

create policy "Users delete own snapshots"
  on public.monthly_snapshots for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Trigger: atualizar updated_at automaticamente
-- ══════════════════════════════════════════════════════════
create trigger monthly_snapshots_updated_at
  before update on public.monthly_snapshots
  for each row execute function public.set_updated_at();
