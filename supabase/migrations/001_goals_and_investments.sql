-- ══════════════════════════════════════════════════════════
-- Tabela: goals (uma meta por usuário)
-- ══════════════════════════════════════════════════════════
create table if not exists public.goals (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null default 'Minha Meta',
  target_amount numeric(12,2) not null default 0,
  target_date date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  constraint goals_one_per_user unique (user_id)
);

alter table public.goals enable row level security;

create policy "Users read own goal"
  on public.goals for select
  using (auth.uid() = user_id);

create policy "Users insert own goal"
  on public.goals for insert
  with check (auth.uid() = user_id);

create policy "Users update own goal"
  on public.goals for update
  using (auth.uid() = user_id);

create policy "Users delete own goal"
  on public.goals for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Tabela: investments (um registro por mês por usuário)
-- ══════════════════════════════════════════════════════════
create table if not exists public.investments (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  month       text not null,  -- formato 'YYYY-MM'
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),

  constraint investments_one_per_month unique (user_id, month)
);

alter table public.investments enable row level security;

create policy "Users read own investments"
  on public.investments for select
  using (auth.uid() = user_id);

create policy "Users insert own investments"
  on public.investments for insert
  with check (auth.uid() = user_id);

create policy "Users update own investments"
  on public.investments for update
  using (auth.uid() = user_id);

create policy "Users delete own investments"
  on public.investments for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Trigger: atualizar updated_at automaticamente
-- ══════════════════════════════════════════════════════════
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

create trigger investments_updated_at
  before update on public.investments
  for each row execute function public.set_updated_at();
