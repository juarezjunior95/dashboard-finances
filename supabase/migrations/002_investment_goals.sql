-- ══════════════════════════════════════════════════════════
-- Tabela: investment_goals (uma meta por usuário)
-- ══════════════════════════════════════════════════════════
create table if not exists public.investment_goals (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references auth.users(id) on delete cascade not null,
  title         text default 'Minha Meta',
  target_amount numeric(12,2) not null default 0,
  target_date   date not null default current_date,
  created_at    timestamptz default now(),
  constraint    investment_goals_one_per_user unique (user_id)
);

alter table public.investment_goals enable row level security;

create policy "Users read own investment_goals"
  on public.investment_goals for select
  using (auth.uid() = user_id);

create policy "Users insert own investment_goals"
  on public.investment_goals for insert
  with check (auth.uid() = user_id);

create policy "Users update own investment_goals"
  on public.investment_goals for update
  using (auth.uid() = user_id);

create policy "Users delete own investment_goals"
  on public.investment_goals for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Migrar dados da tabela goals (se existir) para investment_goals
-- ══════════════════════════════════════════════════════════
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'goals'
  ) then
    insert into public.investment_goals (user_id, title, target_amount, target_date, created_at)
    select user_id, title, target_amount, coalesce(target_date, current_date), created_at
    from public.goals
    on conflict (user_id) do nothing;
  end if;
end $$;
